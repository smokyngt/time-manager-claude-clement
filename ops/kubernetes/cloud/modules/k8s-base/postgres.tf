locals {
  pg_name          = "time-manager-db"
  pg_rw_host       = "${local.pg_name}-rw.${local.ns.databases}.svc.cluster.local"
  pg_port          = 5432
  pg_app_secret    = "postgres-app-credentials"
  pg_server_secret = "${local.pg_name}-server"
  pg_repl_secret   = "${local.pg_name}-replication"
  pg_s3_secret     = "backup-s3"
  pg_s3_path       = "s3://${var.backup_s3_bucket}/${var.backup_s3_prefix}/cnpg"
  pg_storage_class = coalesce(var.postgres_storage_class, var.storage_class_retain)
  pg_renew_before  = "${floor(tonumber(trimsuffix(var.postgres_certificate_duration, "h")) / 3)}h"
  pg_parameters    = merge(var.postgres_parameters, { password_encryption = "scram-sha-256" })

  pg_labels = merge(local.common_labels, {
    "app.kubernetes.io/name"      = "postgresql"
    "app.kubernetes.io/component" = "database"
  })

  pg_instance_selector = merge(var.postgres_pod_labels, { "cnpg.io/cluster" = local.pg_name })

  pg_dns_names = [for s in ["rw", "ro", "r"] : "${local.pg_name}-${s}.${local.ns.databases}.svc.cluster.local"]

  s3_egress_peers = [
    for c in var.backup_s3_egress_cidrs : {
      ipBlock = merge(
        { cidr = c },
        c == "0.0.0.0/0" && length(var.backup_s3_egress_except_cidrs) > 0 ? { except = var.backup_s3_egress_except_cidrs } : {},
      )
    }
  ]

  pg_certificates = merge(
    { serverCASecret = local.pg_server_secret, serverTLSSecret = local.pg_server_secret },
    var.postgres_client_certificates_from_vault ? { clientCASecret = local.pg_repl_secret, replicationTLSSecret = local.pg_repl_secret } : {},
  )

  pg_managed_roles = concat(
    [{
      name           = var.postgres_owner
      ensure         = "present"
      login          = true
      passwordSecret = { name = local.pg_app_secret }
      comment        = "Application owner; the password follows the Terraform-managed Secret"
    }],
    var.features.restore_jobs ? [{
      name           = "tm_restore"
      ensure         = "present"
      login          = true
      createdb       = true
      passwordSecret = { name = "postgres-restore-credentials" }
      comment        = "Restore drills only (scratch databases); present while features.restore_jobs is true"
    }] : [],
  )

  kube_api_egress_peers = [for c in var.kube_api_cidrs : { ipBlock = { cidr = c } }]
  kube_api_egress_ports = [for p in var.kube_api_ports : { protocol = "TCP", port = p }]
}

resource "random_password" "postgres_app" {
  length  = 40
  special = false
}

resource "random_password" "postgres_restore" {
  for_each = var.features.restore_jobs ? toset(["restore"]) : toset([])

  length  = 40
  special = false
}

resource "vault_kv_secret_v2" "postgres" {
  mount = vault_mount.kv.path
  name  = "databases/postgres"

  data_json = jsonencode({
    username = var.postgres_owner
    password = random_password.postgres_app.result
    host     = local.pg_rw_host
    port     = tostring(local.pg_port)
    database = var.postgres_database
  })

  depends_on = [vault_kv_secret_backend_v2.kv]
}

resource "kubernetes_secret_v1" "postgres_app" {
  metadata {
    name      = local.pg_app_secret
    namespace = local.ns.databases
    labels    = merge(local.pg_labels, { "cnpg.io/reload" = "true" })
  }

  type = "kubernetes.io/basic-auth"

  data = {
    username = var.postgres_owner
    password = random_password.postgres_app.result
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_secret_v1" "postgres_restore_databases" {
  for_each = random_password.postgres_restore

  metadata {
    name      = "postgres-restore-credentials"
    namespace = local.ns.databases
    labels    = merge(local.pg_labels, { "cnpg.io/reload" = "true" })
  }

  type = "kubernetes.io/basic-auth"

  data = {
    username = "tm_restore"
    password = each.value.result
  }

  depends_on = [kubernetes_namespace_v1.this]
}

locals {
  cnpg_values = {
    fullnameOverride  = "cnpg"
    crds              = { create = true }
    config            = { clusterWide = true }
    replicaCount      = 2
    priorityClassName = "critical"
    podAnnotations    = { "linkerd.io/inject" = "disabled" }
    podLabels         = { "app.kubernetes.io/part-of" = "time-manager" }
    resources = {
      requests = { cpu = "100m", memory = "128Mi" }
      limits   = { memory = "256Mi" }
    }
    nodeSelector = local.data_scheduling.nodeSelector
    tolerations  = local.data_scheduling.tolerations
    affinity = {
      podAntiAffinity = {
        preferredDuringSchedulingIgnoredDuringExecution = [{
          weight = 100
          podAffinityTerm = {
            topologyKey   = "kubernetes.io/hostname"
            labelSelector = { matchLabels = { "app.kubernetes.io/name" = "cloudnative-pg" } }
          }
        }]
      }
    }
    monitoring = { podMonitorEnabled = false }
  }
}

resource "helm_release" "cloudnative_pg" {
  name       = "cnpg"
  repository = "https://cloudnative-pg.github.io/charts"
  chart      = "cloudnative-pg"
  version    = local.chart_versions["cloudnative-pg"]
  namespace  = local.ns.databases

  wait            = true
  timeout         = 600
  atomic          = true
  cleanup_on_fail = true

  values = [yamlencode(local.cnpg_values)]

  depends_on = [
    kubernetes_namespace_v1.this,
    kubernetes_priority_class_v1.critical,
  ]
}

locals {
  postgres_manifests = {
    server_certificate = <<-YAML
      apiVersion: cert-manager.io/v1
      kind: Certificate
      metadata:
        name: ${local.pg_server_secret}
        namespace: ${local.ns.databases}
        labels:
          ${indent(4, yamlencode(local.pg_labels))}
      spec:
        secretName: ${local.pg_server_secret}
        secretTemplate:
          labels:
            cnpg.io/reload: ""
        commonName: ${local.pg_dns_names[0]}
        duration: ${var.postgres_certificate_duration}
        renewBefore: ${local.pg_renew_before}
        usages:
          - server auth
          - digital signature
          - key encipherment
        dnsNames:
          ${indent(4, yamlencode(local.pg_dns_names))}
        privateKey:
          algorithm: ECDSA
          size: 256
          rotationPolicy: Always
        issuerRef:
          name: ${local.vault_pki_issuer}
          kind: ClusterIssuer
          group: cert-manager.io
    YAML

    replication_certificate = <<-YAML
      apiVersion: cert-manager.io/v1
      kind: Certificate
      metadata:
        name: ${local.pg_repl_secret}
        namespace: ${local.ns.databases}
        labels:
          ${indent(4, yamlencode(local.pg_labels))}
      spec:
        secretName: ${local.pg_repl_secret}
        secretTemplate:
          labels:
            cnpg.io/reload: ""
        commonName: streaming_replica
        duration: ${var.postgres_certificate_duration}
        renewBefore: ${local.pg_renew_before}
        usages:
          - client auth
          - digital signature
          - key encipherment
        privateKey:
          algorithm: ECDSA
          size: 256
          rotationPolicy: Always
        issuerRef:
          name: ${local.vault_pki_issuer}
          kind: ClusterIssuer
          group: cert-manager.io
    YAML

    cluster = <<-YAML
      apiVersion: postgresql.cnpg.io/v1
      kind: Cluster
      metadata:
        name: ${local.pg_name}
        namespace: ${local.ns.databases}
        labels:
          ${indent(4, yamlencode(local.pg_labels))}
      spec:
        description: Time Manager PostgreSQL (CloudNativePG, TLS only, backups to S3)
        instances: ${var.postgres_instances}
        imageName: ${var.postgres_image}
        imagePullPolicy: IfNotPresent
        priorityClassName: critical
        enableSuperuserAccess: false
        enablePDB: false
        primaryUpdateStrategy: unsupervised
        primaryUpdateMethod: switchover
        startDelay: 600
        stopDelay: 1800
        switchoverDelay: 3600
        logLevel: info
        inheritedMetadata:
          labels:
            ${indent(6, yamlencode(local.pg_labels))}
          annotations:
            linkerd.io/inject: disabled
        bootstrap:
          initdb:
            database: ${var.postgres_database}
            owner: ${var.postgres_owner}
            dataChecksums: true
            encoding: UTF8
            secret:
              name: ${local.pg_app_secret}
        postgresql:
          parameters:
            ${indent(6, yamlencode(local.pg_parameters))}
          pg_hba:
            - hostssl all all all scram-sha-256
        certificates:
          ${indent(4, yamlencode(local.pg_certificates))}
        managed:
          roles:
            ${indent(6, yamlencode(local.pg_managed_roles))}
        storage:
          size: ${var.postgres_storage_size}
          storageClass: ${local.pg_storage_class}
          resizeInUseVolumes: true
        walStorage:
          size: ${var.postgres_wal_storage_size}
          storageClass: ${local.pg_storage_class}
          resizeInUseVolumes: true
        resources:
          ${indent(4, yamlencode(var.postgres_resources))}
        affinity:
          enablePodAntiAffinity: true
          topologyKey: kubernetes.io/hostname
          podAntiAffinityType: preferred
          nodeSelector: ${jsonencode(local.data_scheduling.nodeSelector)}
          tolerations: ${jsonencode(local.data_scheduling.tolerations)}
        topologySpreadConstraints:
          - maxSkew: 1
            topologyKey: topology.kubernetes.io/zone
            whenUnsatisfiable: ScheduleAnyway
            labelSelector:
              matchLabels:
                cnpg.io/cluster: ${local.pg_name}
        monitoring:
          enablePodMonitor: false
        backup:
          retentionPolicy: ${var.postgres_backup_retention}
          target: prefer-standby
          barmanObjectStore:
            destinationPath: ${local.pg_s3_path}
            endpointURL: ${var.backup_s3_endpoint}
            s3Credentials:
              accessKeyId:
                name: ${local.pg_s3_secret}
                key: ACCESS_KEY_ID
              secretAccessKey:
                name: ${local.pg_s3_secret}
                key: ACCESS_SECRET_KEY
            wal:
              compression: gzip
              maxParallel: 2
            data:
              compression: gzip
              jobs: 2
    YAML

    scheduled_backup = <<-YAML
      apiVersion: postgresql.cnpg.io/v1
      kind: ScheduledBackup
      metadata:
        name: ${local.pg_name}-daily
        namespace: ${local.ns.databases}
        labels:
          ${indent(4, yamlencode(local.pg_labels))}
      spec:
        schedule: "${var.postgres_backup_schedule}"
        immediate: true
        suspend: false
        backupOwnerReference: self
        method: barmanObjectStore
        target: prefer-standby
        cluster:
          name: ${local.pg_name}
    YAML

    pod_disruption_budget = <<-YAML
      apiVersion: policy/v1
      kind: PodDisruptionBudget
      metadata:
        name: ${local.pg_name}
        namespace: ${local.ns.databases}
        labels:
          ${indent(4, yamlencode(local.pg_labels))}
      spec:
        maxUnavailable: 1
        selector:
          matchLabels:
            cnpg.io/cluster: ${local.pg_name}
    YAML

    pod_monitor = <<-YAML
      apiVersion: monitoring.coreos.com/v1
      kind: PodMonitor
      metadata:
        name: ${local.pg_name}
        namespace: ${local.ns.databases}
        labels:
          ${indent(4, yamlencode(merge(local.pg_labels, { release = var.prometheus_release_label })))}
      spec:
        selector:
          matchLabels:
            cnpg.io/cluster: ${local.pg_name}
        podMetricsEndpoints:
          - port: metrics
            scheme: http
            interval: 30s
            scrapeTimeout: 10s
    YAML
  }

  postgres_network_policies = {
    "allow-app-to-postgres" = <<-YAML
      apiVersion: networking.k8s.io/v1
      kind: NetworkPolicy
      metadata:
        name: allow-app-to-postgres
        namespace: ${local.ns.databases}
        labels:
          ${indent(4, yamlencode(local.pg_labels))}
      spec:
        podSelector:
          matchLabels:
            ${indent(6, yamlencode(local.pg_instance_selector))}
        policyTypes:
          - Ingress
        ingress:
          - from:
              - namespaceSelector:
                  matchLabels:
                    kubernetes.io/metadata.name: ${local.ns.app}
                podSelector:
                  matchLabels:
                    ${indent(14, yamlencode(var.postgres_app_client_pod_labels))}
            ports:
              - protocol: TCP
                port: ${local.pg_port}
    YAML

    "allow-monitoring-to-postgres" = <<-YAML
      apiVersion: networking.k8s.io/v1
      kind: NetworkPolicy
      metadata:
        name: allow-monitoring-to-postgres
        namespace: ${local.ns.databases}
        labels:
          ${indent(4, yamlencode(local.pg_labels))}
      spec:
        podSelector:
          matchLabels:
            ${indent(6, yamlencode(var.postgres_pod_labels))}
        policyTypes:
          - Ingress
        ingress:
          - from:
              - namespaceSelector:
                  matchLabels:
                    kubernetes.io/metadata.name: ${local.ns.monitoring}
                podSelector:
                  matchLabels:
                    ${indent(14, yamlencode(var.prometheus_pod_labels))}
            ports:
              - protocol: TCP
                port: 9187
    YAML

    "allow-backup-to-postgres" = <<-YAML
      apiVersion: networking.k8s.io/v1
      kind: NetworkPolicy
      metadata:
        name: allow-backup-to-postgres
        namespace: ${local.ns.databases}
        labels:
          ${indent(4, yamlencode(local.pg_labels))}
      spec:
        podSelector:
          matchLabels:
            ${indent(6, yamlencode(var.postgres_pod_labels))}
        policyTypes:
          - Ingress
        ingress:
          - from:
              - namespaceSelector:
                  matchLabels:
                    kubernetes.io/metadata.name: ${local.ns.backup}
                podSelector:
                  matchLabels:
                    timemanager.io/postgres-client: "true"
            ports:
              - protocol: TCP
                port: ${local.pg_port}
    YAML

    "allow-cnpg-intra-namespace" = <<-YAML
      apiVersion: networking.k8s.io/v1
      kind: NetworkPolicy
      metadata:
        name: allow-cnpg-intra-namespace
        namespace: ${local.ns.databases}
        labels:
          ${indent(4, yamlencode(local.pg_labels))}
      spec:
        podSelector: {}
        policyTypes:
          - Ingress
          - Egress
        ingress:
          - from:
              - podSelector: {}
            ports:
              - protocol: TCP
                port: ${local.pg_port}
              - protocol: TCP
                port: 8000
        egress:
          - to:
              - podSelector: {}
            ports:
              - protocol: TCP
                port: ${local.pg_port}
              - protocol: TCP
                port: 8000
    YAML

    "allow-cnpg-to-kube-api" = <<-YAML
      apiVersion: networking.k8s.io/v1
      kind: NetworkPolicy
      metadata:
        name: allow-cnpg-to-kube-api
        namespace: ${local.ns.databases}
        labels:
          ${indent(4, yamlencode(local.pg_labels))}
      spec:
        podSelector: {}
        policyTypes:
          - Egress
        egress:
          - to:
              ${indent(8, yamlencode(local.kube_api_egress_peers))}
            ports:
              ${indent(8, yamlencode(local.kube_api_egress_ports))}
    YAML

    "allow-kube-api-to-cnpg-webhook" = <<-YAML
      apiVersion: networking.k8s.io/v1
      kind: NetworkPolicy
      metadata:
        name: allow-kube-api-to-cnpg-webhook
        namespace: ${local.ns.databases}
        labels:
          ${indent(4, yamlencode(local.pg_labels))}
      spec:
        podSelector:
          matchLabels:
            app.kubernetes.io/name: cloudnative-pg
        policyTypes:
          - Ingress
        ingress:
          - from:
              - ipBlock:
                  cidr: 0.0.0.0/0
            ports:
              - protocol: TCP
                port: 9443
    YAML

    "allow-postgres-to-s3" = <<-YAML
      apiVersion: networking.k8s.io/v1
      kind: NetworkPolicy
      metadata:
        name: allow-postgres-to-s3
        namespace: ${local.ns.databases}
        labels:
          ${indent(4, yamlencode(local.pg_labels))}
      spec:
        podSelector:
          matchLabels:
            ${indent(6, yamlencode(var.postgres_pod_labels))}
        policyTypes:
          - Egress
        egress:
          - to:
              ${indent(8, yamlencode(local.s3_egress_peers))}
            ports:
              - protocol: TCP
                port: ${var.backup_s3_port}
    YAML
  }
}

resource "kubectl_manifest" "postgres_server_certificate" {
  yaml_body = local.postgres_manifests.server_certificate

  depends_on = [
    kubernetes_namespace_v1.this,
    kubectl_manifest.vault_pki_issuer,
  ]
}

resource "kubectl_manifest" "postgres_replication_certificate" {
  for_each = var.postgres_client_certificates_from_vault ? toset(["replication"]) : toset([])

  yaml_body = local.postgres_manifests.replication_certificate

  depends_on = [
    kubernetes_namespace_v1.this,
    kubectl_manifest.vault_pki_issuer,
  ]
}

resource "kubectl_manifest" "postgres_network_policy" {
  for_each = local.postgres_network_policies

  yaml_body = each.value

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubectl_manifest" "postgres_cluster" {
  yaml_body = local.postgres_manifests.cluster

  wait_for_rollout = false

  depends_on = [
    helm_release.cloudnative_pg,
    kubectl_manifest.postgres_server_certificate,
    kubectl_manifest.postgres_replication_certificate,
    kubectl_manifest.postgres_network_policy,
    kubectl_manifest.external_secret,
    kubernetes_secret_v1.postgres_app,
    kubernetes_secret_v1.postgres_restore_databases,
    vault_kv_secret_v2.postgres,
    kubernetes_priority_class_v1.critical,
  ]
}

resource "kubectl_manifest" "postgres_scheduled_backup" {
  yaml_body = local.postgres_manifests.scheduled_backup

  depends_on = [kubectl_manifest.postgres_cluster]
}

resource "kubectl_manifest" "postgres_pod_disruption_budget" {
  yaml_body = local.postgres_manifests.pod_disruption_budget

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubectl_manifest" "postgres_pod_monitor" {
  yaml_body = local.postgres_manifests.pod_monitor

  depends_on = [
    helm_release.kube_prometheus_stack,
    kubectl_manifest.postgres_cluster,
  ]
}
