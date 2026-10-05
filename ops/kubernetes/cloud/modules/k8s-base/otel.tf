locals {
  otlp_service_fqdn  = "${var.alloy_service_name}.${local.mon_ns}.svc.cluster.local"
  otlp_scheme        = var.otlp_tls_enabled ? "https" : "http"
  otlp_endpoint_http = "${local.otlp_scheme}://${local.otlp_service_fqdn}:4318"
  otlp_endpoint_grpc = "${local.otlp_scheme}://${local.otlp_service_fqdn}:4317"
  otlp_tls_secret    = "alloy-otlp-tls"
  ca_mount_dir       = "/etc/internal-ca"

  log_namespaces = var.monitoring_log_namespaces == null ? sort(values(local.ns)) : var.monitoring_log_namespaces

  stack_scrape_targets = {
    prometheus   = "${local.prometheus_service}:9090"
    alertmanager = "${local.alertmanager_service}:9093"
    grafana      = "${local.grafana_service}:80"
    loki         = "loki:3100"
    tempo        = "tempo:3200"
  }

  tempo_source = yamldecode(file("${local.obs_dir}/tempo/tempo.yaml"))

  tempo_config = merge(local.tempo_source, {
    metrics_generator = merge(local.tempo_source.metrics_generator, {
      storage = merge(local.tempo_source.metrics_generator.storage, {
        remote_write = [for rw in local.tempo_source.metrics_generator.storage.remote_write : merge(rw, { url = "${local.prometheus_url}/api/v1/write" })]
      })
    })
  })

  tempo_values = {
    fullnameOverride  = "tempo"
    priorityClassName = "default-priority"
    config            = yamlencode(local.tempo_config)
    tempo = {
      resources = var.monitoring_resources.tempo
      receivers = local.tempo_source.distributor.receivers
      retention = local.tempo_source.compactor.compaction.block_retention
      metricsGenerator = {
        enabled = true
      }
    }
    persistence = {
      enabled          = true
      size             = var.monitoring_storage.tempo
      storageClassName = var.storage_class_default
    }
    serviceAccount = { automountServiceAccountToken = false }
  }

  alloy_common_security_context = {
    allowPrivilegeEscalation = false
    readOnlyRootFilesystem   = true
    runAsNonRoot             = true
    runAsUser                = 473
    runAsGroup               = 473
    capabilities             = { drop = ["ALL"] }
    seccompProfile           = { type = "RuntimeDefault" }
  }

  alloy_logs_rbac_rules = [{ apiGroups = [""], resources = ["pods", "pods/log", "namespaces"], verbs = ["get", "list", "watch"] }]

  alloy_storage_volume = { name = "storage", emptyDir = { sizeLimit = "256Mi" } }
  alloy_storage_mount  = { name = "storage", mountPath = "/tmp/alloy" }

  alloy_gateway_values = {
    alloy = {
      enableReporting = false
      configMap = {
        create = false
        name   = "alloy-gateway-config"
        key    = "config.alloy"
      }
      extraPorts = [
        { name = "otlp-grpc", port = 4317, targetPort = 4317, protocol = "TCP" },
        { name = "otlp-http", port = 4318, targetPort = 4318, protocol = "TCP" },
      ]
      resources       = var.monitoring_resources.alloy_gateway
      securityContext = local.alloy_common_security_context
      mounts = {
        extra = concat(
          [
            local.alloy_storage_mount,
            { name = "internal-ca", mountPath = local.ca_mount_dir, readOnly = true },
          ],
          var.otlp_tls_enabled ? [{ name = "otlp-tls", mountPath = "/etc/alloy-tls", readOnly = true }] : [],
        )
      }
    }
    controller = {
      type              = "deployment"
      replicas          = 1
      priorityClassName = "critical"
      podAnnotations    = { "config.linkerd.io/opaque-ports" = "4317,4318" }
      volumes = {
        extra = concat(
          [
            local.alloy_storage_volume,
            { name = "internal-ca", secret = { secretName = local.ca_bundle_secret } },
          ],
          var.otlp_tls_enabled ? [{ name = "otlp-tls", secret = { secretName = local.otlp_tls_secret } }] : [],
        )
      }
    }
    rbac           = { create = false }
    serviceAccount = { create = true, automountServiceAccountToken = false }
  }

  alloy_logs_values = {
    nameOverride = "alloy-logs"
    alloy = {
      enableReporting = false
      configMap = {
        create = false
        name   = "alloy-logs-config"
        key    = "config.alloy"
      }
      extraEnv = [{
        name      = "NODE_NAME"
        valueFrom = { fieldRef = { fieldPath = "spec.nodeName" } }
      }]
      resources       = var.monitoring_resources.alloy_logs
      securityContext = local.alloy_common_security_context
      mounts          = { extra = [local.alloy_storage_mount] }
    }
    controller = {
      type              = "daemonset"
      priorityClassName = "critical"
      tolerations       = [{ operator = "Exists" }]
      volumes           = { extra = [local.alloy_storage_volume] }
    }
    rbac = {
      create       = true
      rules        = local.alloy_logs_rbac_rules
      clusterRules = local.alloy_logs_rbac_rules
    }
    service        = { enabled = false }
    serviceAccount = { create = true }
  }

  alloy_otlp_certificate_manifest = <<-YAML
    apiVersion: cert-manager.io/v1
    kind: Certificate
    metadata:
      name: alloy-otlp
      namespace: ${local.mon_ns}
      labels: ${jsonencode(local.common_labels)}
    spec:
      secretName: ${local.otlp_tls_secret}
      commonName: ${local.otlp_service_fqdn}
      dnsNames:
        - ${local.otlp_service_fqdn}
      duration: ${var.otlp_certificate.duration}
      renewBefore: ${var.otlp_certificate.renew_before}
      usages:
        - server auth
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
}

resource "kubectl_manifest" "alloy_otlp_certificate" {
  for_each = var.otlp_tls_enabled ? toset(["alloy-otlp"]) : toset([])

  yaml_body = local.alloy_otlp_certificate_manifest

  depends_on = [
    kubernetes_namespace_v1.this,
    kubectl_manifest.vault_pki_issuer,
  ]
}

resource "helm_release" "tempo" {
  name       = "tempo"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "tempo"
  version    = local.chart_versions["tempo"]
  namespace  = kubernetes_namespace_v1.this[local.mon_ns].metadata[0].name

  wait    = true
  timeout = 900

  values = [yamlencode(local.tempo_values)]

  depends_on = [
    kubernetes_priority_class_v1.default_priority,
    helm_release.kube_prometheus_stack,
  ]
}

resource "kubernetes_config_map_v1" "alloy_gateway_config" {
  metadata {
    name      = "alloy-gateway-config"
    namespace = local.mon_ns
    labels    = local.common_labels
  }

  data = {
    "config.alloy" = templatefile("${path.module}/files/alloy-gateway.alloy.tftpl", {
      otlp_tls             = var.otlp_tls_enabled
      tempo_endpoint       = local.tempo_otlp_endpoint
      prometheus_write_url = "${local.prometheus_url}/api/v1/write"
      probe_targets        = var.monitoring_probe_targets
      stack_targets        = local.stack_scrape_targets
      ca_file              = "${local.ca_mount_dir}/${local.ca_bundle_key}"
    })
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_config_map_v1" "alloy_logs_config" {
  metadata {
    name      = "alloy-logs-config"
    namespace = local.mon_ns
    labels    = local.common_labels
  }

  data = {
    "config.alloy" = templatefile("${path.module}/files/alloy-logs.alloy.tftpl", {
      log_namespaces = join("|", local.log_namespaces)
      loki_push_url  = "${local.loki_url}/loki/api/v1/push"
    })
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "helm_release" "alloy_gateway" {
  name       = "alloy"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "alloy"
  version    = local.chart_versions["alloy"]
  namespace  = kubernetes_namespace_v1.this[local.mon_ns].metadata[0].name

  wait    = true
  timeout = 900

  values = [yamlencode(local.alloy_gateway_values)]

  depends_on = [
    kubernetes_priority_class_v1.critical,
    kubernetes_config_map_v1.alloy_gateway_config,
    kubectl_manifest.alloy_otlp_certificate,
    kubernetes_secret_v1.ca_bundle,
    helm_release.kube_prometheus_stack,
    helm_release.tempo,
  ]
}

resource "helm_release" "alloy_logs" {
  name       = "alloy-logs"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "alloy"
  version    = local.chart_versions["alloy"]
  namespace  = kubernetes_namespace_v1.this[local.mon_ns].metadata[0].name

  wait    = true
  timeout = 900

  values = [yamlencode(local.alloy_logs_values)]

  depends_on = [
    kubernetes_priority_class_v1.critical,
    kubernetes_config_map_v1.alloy_logs_config,
    helm_release.loki,
  ]
}
