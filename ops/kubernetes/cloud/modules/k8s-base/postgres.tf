locals {
  postgres_cluster_name = "time-manager-db"
  postgres_backup_on    = var.postgres_backup_destination != ""

  postgres_cluster = {
    apiVersion = "postgresql.cnpg.io/v1"
    kind       = "Cluster"
    metadata = {
      name      = local.postgres_cluster_name
      namespace = local.ns.app
    }
    spec = merge(
      {
        instances             = var.postgres_instances
        imageName             = "ghcr.io/cloudnative-pg/postgresql:${var.image_tags.postgres}"
        primaryUpdateStrategy = "unsupervised"
        enableSuperuserAccess = false
        postgresql = {
          parameters = {
            password_encryption        = "scram-sha-256"
            max_connections            = "200"
            log_min_duration_statement = "500"
          }
          pg_hba = ["host all all all scram-sha-256"]
        }
        bootstrap = {
          initdb = {
            database = var.postgres_database
            owner    = "timemanager"
            secret   = { name = "postgres-credentials" }
          }
        }
        storage = merge(
          { size = var.postgres_storage_size },
          var.storage_class == null ? {} : { storageClass = var.storage_class },
        )
        resources = var.postgres_resources
        affinity = {
          enablePodAntiAffinity = true
          topologyKey           = "kubernetes.io/hostname"
          podAntiAffinityType   = "preferred"
          nodeSelector          = var.data_node_selector
          tolerations           = local.data_tolerations
        }
        topologySpreadConstraints = [{
          maxSkew           = 1
          topologyKey       = "topology.kubernetes.io/zone"
          whenUnsatisfiable = "ScheduleAnyway"
          labelSelector     = { matchLabels = { "cnpg.io/cluster" = local.postgres_cluster_name } }
        }]
        monitoring = {
          enablePodMonitor = false
        }
      },
      local.postgres_backup_on ? {
        backup = {
          retentionPolicy = var.postgres_backup_retention
          barmanObjectStore = merge(
            {
              destinationPath = var.postgres_backup_destination
              s3Credentials = {
                accessKeyId     = { name = "backup-s3", key = "ACCESS_KEY_ID" }
                secretAccessKey = { name = "backup-s3", key = "ACCESS_SECRET_KEY" }
              }
              wal  = { compression = "gzip" }
              data = { compression = "gzip" }
            },
            var.postgres_backup_endpoint_url == "" ? {} : { endpointURL = var.postgres_backup_endpoint_url },
          )
        }
      } : {},
    )
  }
}

resource "helm_release" "cloudnative_pg" {
  name       = "cnpg"
  repository = "https://cloudnative-pg.github.io/charts"
  chart      = "cloudnative-pg"
  version    = var.chart_versions.cloudnative_pg
  namespace  = kubernetes_namespace_v1.this[local.ns.cnpg].metadata[0].name

  wait    = true
  timeout = 600

  values = [yamlencode({
    fullnameOverride = "cnpg"
    config = {
      clusterWide = true
    }
  })]
}

resource "kubectl_manifest" "postgres_cluster" {
  count = local.vault_config_count

  yaml_body = yamlencode(local.postgres_cluster)

  wait_for_rollout = false

  depends_on = [
    helm_release.cloudnative_pg,
    kubectl_manifest.external_secret,
  ]
}

resource "kubectl_manifest" "postgres_scheduled_backup" {
  count = var.enable_vault_config && local.postgres_backup_on ? 1 : 0

  yaml_body = yamlencode({
    apiVersion = "postgresql.cnpg.io/v1"
    kind       = "ScheduledBackup"
    metadata = {
      name      = "${local.postgres_cluster_name}-daily"
      namespace = local.ns.app
    }
    spec = {
      schedule             = var.postgres_backup_schedule
      backupOwnerReference = "self"
      cluster              = { name = local.postgres_cluster_name }
    }
  })

  depends_on = [kubectl_manifest.postgres_cluster]
}

resource "kubectl_manifest" "postgres_pod_monitor" {
  count = local.vault_config_count

  yaml_body = yamlencode({
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "PodMonitor"
    metadata = {
      name      = local.postgres_cluster_name
      namespace = local.ns.app
      labels    = { "cnpg.io/cluster" = local.postgres_cluster_name }
    }
    spec = {
      selector = {
        matchLabels = { "cnpg.io/cluster" = local.postgres_cluster_name }
      }
      podMetricsEndpoints = [{
        port     = "metrics"
        interval = "30s"
      }]
    }
  })

  depends_on = [helm_release.prometheus_operator_crds]
}
