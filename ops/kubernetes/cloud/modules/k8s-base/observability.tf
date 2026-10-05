locals {
  obs_dir = "${path.module}/../../../../observability"
  obs_ns  = local.ns.observability

  obs_log_namespaces = [local.ns.app, local.ns.vault, local.ns.cnpg, local.ns.ingress, local.ns.external_secrets, local.ns.cert_manager]

  grafana_branding = {
    "grafana_icon.svg"           = "/usr/share/grafana/public/img/grafana_icon.svg"
    "g8_login_dark.svg"          = "/usr/share/grafana/public/img/g8_login_dark.svg"
    "g8_login_light.svg"         = "/usr/share/grafana/public/img/g8_login_light.svg"
    "login_background_dark.svg"  = "/usr/share/grafana/public/img/login_background_dark.svg"
    "login_background_light.svg" = "/usr/share/grafana/public/img/login_background_light.svg"
    "fav32.png"                  = "/usr/share/grafana/public/img/fav32.png"
    "apple-touch-icon.png"       = "/usr/share/grafana/public/img/apple-touch-icon.png"
  }

  alertmanager_source = var.alertmanager_webhook_enabled ? replace(
    file("${local.obs_dir}/alertmanager/alertmanager.webhook.yml"),
    "/tmp/alert-webhook-url",
    "/etc/alertmanager-webhook/url",
  ) : file("${local.obs_dir}/alertmanager/alertmanager.yml")

  loki_config = replace(
    replace(file("${local.obs_dir}/loki/loki.yaml"), "path_prefix: /loki", "path_prefix: /var/loki"),
    ": /loki/",
    ": /var/loki/",
  )

  obs_scheduling = {
    nodeSelector = var.data_node_selector
    tolerations  = local.data_tolerations
  }

  grafana_mounts = concat(
    [
      { name = "grafana-ini", mountPath = "/etc/grafana-config", configMap = "grafana-ini", readOnly = true },
      { name = "prov-datasources", mountPath = "/etc/grafana/provisioning/datasources", configMap = "grafana-provisioning-datasources", readOnly = true },
      { name = "prov-dashboards", mountPath = "/etc/grafana/provisioning/dashboards", configMap = "grafana-provisioning-dashboards", readOnly = true },
      { name = "prov-alerting", mountPath = "/etc/grafana/provisioning/alerting", configMap = "grafana-provisioning-alerting", readOnly = true },
      { name = "prov-plugins", mountPath = "/etc/grafana/provisioning/plugins", configMap = "grafana-provisioning-plugins", readOnly = true },
      { name = "dash-time-manager", mountPath = "/var/lib/grafana/dashboards/time-manager", configMap = "grafana-dashboards-time-manager", readOnly = true },
      { name = "dash-infrastructure", mountPath = "/var/lib/grafana/dashboards/infrastructure", configMap = "grafana-dashboards-infrastructure", readOnly = true },
    ],
    [for file_name, target in local.grafana_branding : {
      name      = "brand-${replace(replace(file_name, ".", "-"), "_", "-")}"
      mountPath = target
      subPath   = file_name
      configMap = "grafana-branding"
      readOnly  = true
    }],
  )

  grafana_oidc_env = var.grafana_oidc_enabled ? {
    GF_AUTH_GENERIC_OAUTH_ENABLED             = "true"
    GF_AUTH_GENERIC_OAUTH_NAME                = "Vault"
    GF_AUTH_GENERIC_OAUTH_SCOPES              = "openid profile email"
    GF_AUTH_GENERIC_OAUTH_AUTH_URL            = "https://${var.vault_oidc_issuer_host}/ui/vault/identity/oidc/provider/grafana/authorize"
    GF_AUTH_GENERIC_OAUTH_TOKEN_URL           = "${local.vault_address}/v1/identity/oidc/provider/grafana/token"
    GF_AUTH_GENERIC_OAUTH_API_URL             = "${local.vault_address}/v1/identity/oidc/provider/grafana/userinfo"
    GF_AUTH_GENERIC_OAUTH_USE_PKCE            = "true"
    GF_AUTH_GENERIC_OAUTH_AUTO_LOGIN          = "false"
    GF_AUTH_GENERIC_OAUTH_ROLE_ATTRIBUTE_PATH = "'Viewer'"
    GF_AUTH_GENERIC_OAUTH_TLS_CLIENT_CA       = "/etc/vault-ca/ca.crt"
  } : {}
}

resource "helm_release" "prometheus_operator_crds" {
  name       = "prometheus-operator-crds"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "prometheus-operator-crds"
  version    = var.chart_versions.prometheus_crds
  namespace  = kubernetes_namespace_v1.this[local.obs_ns].metadata[0].name

  wait = true
}

resource "kubernetes_config_map_v1" "prometheus_config" {
  metadata {
    name      = "prometheus-config"
    namespace = local.obs_ns
  }

  data = {
    "prometheus.yml" = file("${local.obs_dir}/prometheus/prometheus.yml")
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_config_map_v1" "prometheus_rules" {
  metadata {
    name      = "prometheus-rules"
    namespace = local.obs_ns
  }

  data = {
    "recording.yml" = file("${local.obs_dir}/prometheus/rules/recording.yml")
    "alerts.yml"    = file("${local.obs_dir}/prometheus/rules/alerts.yml")
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "helm_release" "prometheus" {
  name       = "prometheus"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "prometheus"
  version    = var.chart_versions.prometheus
  namespace  = local.obs_ns

  wait    = true
  timeout = 600

  values = [yamlencode({
    server = merge({
      fullnameOverride      = "prometheus"
      image                 = { tag = var.image_tags.prometheus }
      configMapOverrideName = "config"
      retention             = var.observability_retention.prometheus_time
      retentionSize         = var.observability_retention.prometheus_size
      extraFlags            = ["web.enable-lifecycle", "web.enable-remote-write-receiver"]
      extraArgs             = { "enable-feature" = "native-histograms,exemplar-storage" }
      service               = { servicePort = 9090 }
      persistentVolume = merge(
        { enabled = true, size = var.observability_storage.prometheus },
        var.storage_class == null ? {} : { storageClass = var.storage_class },
      )
      extraConfigmapMounts = [{
        name      = "prometheus-rules"
        mountPath = "/etc/prometheus/rules"
        configMap = "prometheus-rules"
        readOnly  = true
      }]
    }, local.obs_scheduling)
    alertmanager = merge({
      enabled          = true
      fullnameOverride = "alertmanager"
      image            = { tag = var.image_tags.alertmanager }
      persistence = merge(
        { enabled = true, size = var.observability_storage.alertmanager },
        var.storage_class == null ? {} : { storageClass = var.storage_class },
      )
      config = merge(
        yamldecode(local.alertmanager_source),
        { enabled = true },
      )
      extraArgs = { "data.retention" = "120h" }
      extraSecretMounts = var.alertmanager_webhook_enabled ? [{
        name       = "webhook"
        mountPath  = "/etc/alertmanager-webhook"
        secretName = "alertmanager-webhook"
        readOnly   = true
      }] : []
    }, local.obs_scheduling)
    kube-state-metrics       = { enabled = false }
    prometheus-node-exporter = { enabled = false }
    prometheus-pushgateway   = { enabled = false }
  })]

  depends_on = [
    kubernetes_config_map_v1.prometheus_config,
    kubernetes_config_map_v1.prometheus_rules,
    kubectl_manifest.external_secret,
    helm_release.prometheus_operator_crds,
  ]
}

resource "helm_release" "loki" {
  name       = "loki"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "loki"
  version    = var.chart_versions.loki
  namespace  = local.obs_ns

  wait    = true
  timeout = 600

  values = [yamlencode({
    fullnameOverride = "loki"
    deploymentMode   = "SingleBinary"
    loki = {
      auth_enabled  = false
      useTestSchema = false
      schemaConfig = {
        configs = [{
          from         = "2024-04-01"
          store        = "tsdb"
          object_store = "filesystem"
          schema       = "v13"
          index        = { prefix = "index_", period = "24h" }
        }]
      }
      storage      = { type = "filesystem" }
      commonConfig = { replication_factor = 1 }
      config       = local.loki_config
    }
    singleBinary = merge({
      replicas = 1
      persistence = merge(
        { enabled = true, size = var.observability_storage.loki },
        var.storage_class == null ? {} : { storageClass = var.storage_class },
      )
    }, local.obs_scheduling)
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
    gateway        = { enabled = false }
    chunksCache    = { enabled = false }
    resultsCache   = { enabled = false }
    lokiCanary     = { enabled = false }
    test           = { enabled = false }
    monitoring = {
      selfMonitoring = { enabled = false }
    }
    sidecar = { rules = { enabled = false } }
  })]

  depends_on = [kubernetes_namespace_v1.this]
}

resource "helm_release" "tempo" {
  name       = "tempo"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "tempo"
  version    = var.chart_versions.tempo
  namespace  = local.obs_ns

  wait    = true
  timeout = 600

  values = [yamlencode(merge({
    fullnameOverride = "tempo"
    tempo = {
      tag = var.image_tags.tempo
      receivers = {
        otlp = {
          protocols = {
            grpc = { endpoint = "0.0.0.0:4317" }
            http = { endpoint = "0.0.0.0:4318" }
          }
        }
      }
    }
    config = file("${local.obs_dir}/tempo/tempo.yaml")
    persistence = merge(
      { enabled = true, size = var.observability_storage.tempo },
      var.storage_class == null ? {} : { storageClassName = var.storage_class },
    )
    service = { type = "ClusterIP" }
  }, local.obs_scheduling))]

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_config_map_v1" "alloy_config" {
  metadata {
    name      = "alloy-config"
    namespace = local.obs_ns
  }

  data = {
    "config.alloy" = templatefile("${path.module}/files/alloy.alloy.tftpl", {
      app_namespace  = local.ns.app
      api_scheme     = var.api_backend_tls ? "https" : "http"
      log_namespaces = join(", ", [for n in local.obs_log_namespaces : "\"${n}\""])
    })
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_role_v1" "alloy_app_secrets" {
  metadata {
    name      = "alloy-read-secrets"
    namespace = local.ns.app
  }

  rule {
    api_groups = [""]
    resources  = ["secrets", "configmaps"]
    verbs      = ["get", "list", "watch"]
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_role_binding_v1" "alloy_app_secrets" {
  metadata {
    name      = "alloy-read-secrets"
    namespace = local.ns.app
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role_v1.alloy_app_secrets.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = "alloy"
    namespace = local.obs_ns
  }
}

resource "helm_release" "alloy" {
  name       = "alloy"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "alloy"
  version    = var.chart_versions.alloy
  namespace  = local.obs_ns

  wait    = true
  timeout = 600

  values = [yamlencode({
    fullnameOverride = "alloy"
    image            = { tag = var.image_tags.alloy }
    alloy = {
      configMap = {
        create = false
        name   = "alloy-config"
        key    = "config.alloy"
      }
      extraPorts = [
        { name = "otlp-grpc", port = 4317, targetPort = 4317, protocol = "TCP" },
        { name = "otlp-http", port = 4318, targetPort = 4318, protocol = "TCP" },
      ]
    }
    controller = merge({
      type     = "deployment"
      replicas = 1
    }, local.obs_scheduling)
    rbac = {
      rules = [
        { apiGroups = ["", "discovery.k8s.io", "networking.k8s.io"], resources = ["endpoints", "endpointslices", "ingresses", "pods", "services"], verbs = ["get", "list", "watch"] },
        { apiGroups = [""], resources = ["pods", "pods/log", "namespaces", "events"], verbs = ["get", "list", "watch"] },
        { apiGroups = ["monitoring.coreos.com"], resources = ["podmonitors", "servicemonitors", "probes", "scrapeconfigs"], verbs = ["get", "list", "watch"] },
      ]
    }
  })]

  depends_on = [
    kubernetes_config_map_v1.alloy_config,
    helm_release.prometheus_operator_crds,
    helm_release.loki,
    helm_release.tempo,
    helm_release.prometheus,
  ]
}

resource "kubernetes_config_map_v1" "grafana_ini" {
  metadata {
    name      = "grafana-ini"
    namespace = local.obs_ns
  }

  data = {
    "grafana.ini" = file("${local.obs_dir}/grafana/grafana.ini")
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_config_map_v1" "grafana_provisioning" {
  for_each = {
    datasources = ["datasources/datasources.yaml"]
    dashboards  = ["dashboards/dashboards.yaml"]
    alerting    = ["alerting/contact-points.yaml", "alerting/rules.yaml"]
    plugins     = ["plugins/plugins.yaml"]
  }

  metadata {
    name      = "grafana-provisioning-${each.key}"
    namespace = local.obs_ns
  }

  data = {
    for f in each.value : basename(f) => file("${local.obs_dir}/grafana/provisioning/${f}")
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_config_map_v1" "grafana_dashboards" {
  for_each = toset(["time-manager", "infrastructure"])

  metadata {
    name      = "grafana-dashboards-${each.key}"
    namespace = local.obs_ns
  }

  data = {
    for f in fileset("${local.obs_dir}/grafana/dashboards/${each.key}", "*.json") :
    f => file("${local.obs_dir}/grafana/dashboards/${each.key}/${f}")
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_config_map_v1" "grafana_branding" {
  metadata {
    name      = "grafana-branding"
    namespace = local.obs_ns
  }

  binary_data = {
    for f in keys(local.grafana_branding) :
    f => filebase64("${local.obs_dir}/grafana/branding/${f}")
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "helm_release" "grafana" {
  count = local.vault_config_count

  name       = "grafana"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "grafana"
  version    = var.chart_versions.grafana
  namespace  = local.obs_ns

  wait    = true
  timeout = 600

  values = [yamlencode(merge({
    fullnameOverride = "grafana"
    image            = { tag = var.image_tags.grafana }
    admin = {
      existingSecret = "grafana-admin"
      userKey        = "admin-user"
      passwordKey    = "admin-password"
    }
    persistence = merge(
      { enabled = true, size = var.observability_storage.grafana },
      var.storage_class == null ? {} : { storageClassName = var.storage_class },
    )
    service = { port = 3000 }
    env = merge({
      GF_PATHS_CONFIG           = "/etc/grafana-config/grafana.ini"
      GF_SERVER_ROOT_URL        = "https://${var.grafana_host}"
      GF_SECURITY_COOKIE_SECURE = "true"
      GRAFANA_ALERT_WEBHOOK_URL = var.grafana_alert_webhook_url
    }, local.grafana_oidc_env)
    envFromSecrets       = var.grafana_oidc_enabled ? [{ name = "grafana-oidc" }] : []
    extraConfigmapMounts = local.grafana_mounts
    extraSecretMounts = var.grafana_oidc_enabled ? [{
      name       = "vault-ca"
      mountPath  = "/etc/vault-ca"
      secretName = "vault-ca-bundle"
      readOnly   = true
    }] : []
    securityContext = {
      runAsNonRoot = true
      runAsUser    = 472
      runAsGroup   = 472
      fsGroup      = 472
    }
    containerSecurityContext = {
      allowPrivilegeEscalation = false
      capabilities             = { drop = ["ALL"] }
      seccompProfile           = { type = "RuntimeDefault" }
    }
    testFramework = { enabled = false }
  }, local.obs_scheduling))]

  depends_on = [
    kubernetes_config_map_v1.grafana_ini,
    kubernetes_config_map_v1.grafana_provisioning,
    kubernetes_config_map_v1.grafana_dashboards,
    kubernetes_config_map_v1.grafana_branding,
    kubectl_manifest.external_secret,
    kubernetes_secret_v1.vault_ca_bundle_observability,
    helm_release.prometheus,
    helm_release.loki,
    helm_release.tempo,
  ]
}

resource "kubernetes_secret_v1" "vault_ca_bundle_observability" {
  count = local.vault_config_count

  metadata {
    name      = local.vault_ca_bundle_name
    namespace = local.obs_ns
  }

  data = {
    "ca.crt" = "${join("\n", local.live_ca_pems)}\n"
  }

  depends_on = [kubernetes_namespace_v1.this]
}
