locals {
  loki_source = yamldecode(file("${local.obs_dir}/loki/loki.yaml"))
  loki_s3     = var.loki_object_storage
  loki_store  = local.loki_s3.enabled ? "s3" : "filesystem"

  loki_storage_common = merge(
    local.loki_s3.enabled ? {
      s3 = {
        endpoint         = local.loki_s3.endpoint
        region           = local.loki_s3.region
        bucketnames      = local.loki_s3.bucket
        s3forcepathstyle = local.loki_s3.force_path_style
        insecure         = local.loki_s3.insecure
      }
    } : {},
    local.loki_s3.enabled ? {} : {
      filesystem = {
        chunks_directory = "/var/loki/chunks"
        rules_directory  = "/var/loki/rules"
      }
    },
  )

  loki_schema_configs = [for c in local.loki_source.schema_config.configs : merge(c, { object_store = local.loki_store })]

  loki_structured_config = merge(local.loki_source, {
    common = merge(local.loki_source.common, {
      path_prefix = "/var/loki"
      storage     = local.loki_storage_common
    })
    schema_config = { configs = local.loki_schema_configs }
    compactor = merge(local.loki_source.compactor, {
      working_directory    = "/var/loki/compactor"
      delete_request_store = local.loki_store
    })
  })

  loki_values = {
    fullnameOverride = "loki"
    deploymentMode   = "SingleBinary"

    loki = {
      auth_enabled = false
      commonConfig = { replication_factor = 1 }
      schemaConfig = { configs = local.loki_schema_configs }
      storage = merge(
        { type = local.loki_store },
        local.loki_s3.enabled ? {
          bucketNames = { chunks = local.loki_s3.bucket, ruler = local.loki_s3.bucket, admin = local.loki_s3.bucket }
        } : {},
      )
      structuredConfig = local.loki_structured_config
    }

    singleBinary = {
      replicas          = 1
      resources         = var.monitoring_resources.loki
      priorityClassName = "default-priority"
      extraEnvFrom      = local.loki_s3.enabled ? [{ secretRef = { name = "loki-s3" } }] : []
      persistence = {
        enabled                                  = true
        size                                     = var.monitoring_storage.loki
        storageClass                             = var.storage_class_default
        whenScaled                               = "Retain"
        whenDeleted                              = "Retain"
        enableStatefulSetAutoDeletePVC           = false
        enableStatefulSetRecreationForSizeChange = false
      }
    }

    backend        = { replicas = 0 }
    read           = { replicas = 0 }
    write          = { replicas = 0 }
    ingester       = { replicas = 0 }
    querier        = { replicas = 0 }
    queryFrontend  = { replicas = 0 }
    queryScheduler = { replicas = 0 }
    distributor    = { replicas = 0 }
    compactor      = { replicas = 0 }
    indexGateway   = { replicas = 0 }
    bloomCompactor = { replicas = 0 }
    bloomGateway   = { replicas = 0 }

    gateway      = { enabled = false }
    chunksCache  = { enabled = false }
    resultsCache = { enabled = false }
    lokiCanary   = { enabled = false }
    test         = { enabled = false }
    minio        = { enabled = false }
    sidecar      = { rules = { enabled = false } }
    monitoring = {
      selfMonitoring = { enabled = false }
      serviceMonitor = { enabled = false }
    }
  }
}

resource "helm_release" "loki" {
  name       = "loki"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "loki"
  version    = local.chart_versions["loki"]
  namespace  = kubernetes_namespace_v1.this[local.mon_ns].metadata[0].name

  wait    = true
  timeout = 900

  values = [yamlencode(local.loki_values)]

  depends_on = [
    kubernetes_priority_class_v1.default_priority,
    kubectl_manifest.monitoring_external_secret,
  ]
}
