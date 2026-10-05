locals {
  obs_dir = "${path.module}/../../../../observability"
  mon_ns  = local.ns.monitoring

  prom_release         = "kube-prometheus-stack"
  prometheus_service   = "${local.prom_release}-prometheus"
  alertmanager_service = "${local.prom_release}-alertmanager"
  grafana_service      = "${local.prom_release}-grafana"
  prometheus_url       = "http://${local.prometheus_service}:9090"
  alertmanager_url     = "http://${local.alertmanager_service}:9093"
  loki_url             = "http://loki:3100"
  tempo_url            = "http://tempo:3200"
  tempo_otlp_endpoint  = "tempo:4317"

  compose_prometheus  = yamldecode(file("${local.obs_dir}/prometheus/prometheus.yml"))
  compose_datasources = yamldecode(file("${local.obs_dir}/grafana/provisioning/datasources/datasources.yaml"))
  compose_dashboards  = yamldecode(file("${local.obs_dir}/grafana/provisioning/dashboards/dashboards.yaml"))

  datasource_urls = {
    prometheus   = local.prometheus_url
    tempo        = local.tempo_url
    loki         = local.loki_url
    alertmanager = local.alertmanager_url
  }

  grafana_datasources = merge(local.compose_datasources, {
    datasources = [for ds in local.compose_datasources.datasources : merge(ds, { url = local.datasource_urls[ds.uid] })]
  })

  grafana_folders = { for p in local.compose_dashboards.providers : basename(p.options.path) => p.folder }

  grafana_dashboard_files = flatten([
    for dir, folder in local.grafana_folders : [
      for f in fileset("${local.obs_dir}/grafana/dashboards/${dir}", "*.json") : {
        key    = "${dir}-${trimsuffix(f, ".json")}"
        folder = folder
        file   = f
        path   = "${local.obs_dir}/grafana/dashboards/${dir}/${f}"
      }
    ]
  ])

  grafana_branding_files = sort(fileset("${local.obs_dir}/grafana/branding", "*"))

  alertmanager_secret_dir = "/etc/alertmanager/secrets/alertmanager-webhook"

  alertmanager_source = yamldecode(var.monitoring_alert_webhook_enabled ? replace(
    file("${local.obs_dir}/alertmanager/alertmanager.webhook.yml"),
    "/tmp/alert-webhook-url",
    "${local.alertmanager_secret_dir}/url",
  ) : file("${local.obs_dir}/alertmanager/alertmanager.yml"))

  alertmanager_config = merge(local.alertmanager_source, {
    route = merge(local.alertmanager_source.route, {
      routes = [{
        receiver = "null"
        matchers = ["alertname=~\"Watchdog|InfoInhibitor\""]
      }]
    })
    receivers = concat(local.alertmanager_source.receivers, var.monitoring_alert_webhook_enabled ? [{ name = "null" }] : [])
  })

  grafana_oidc_enabled = var.features.grafana_oidc

  grafana_oidc_env = local.grafana_oidc_enabled ? {
    GF_AUTH_GENERIC_OAUTH_ENABLED              = "true"
    GF_AUTH_GENERIC_OAUTH_NAME                 = "Vault"
    GF_AUTH_GENERIC_OAUTH_SCOPES               = "openid profile email"
    GF_AUTH_GENERIC_OAUTH_AUTH_URL             = "https://${local.hosts.vault}/ui/vault/identity/oidc/provider/grafana/authorize"
    GF_AUTH_GENERIC_OAUTH_TOKEN_URL            = "${local.vault_url}/v1/identity/oidc/provider/grafana/token"
    GF_AUTH_GENERIC_OAUTH_API_URL              = "${local.vault_url}/v1/identity/oidc/provider/grafana/userinfo"
    GF_AUTH_GENERIC_OAUTH_USE_PKCE             = "true"
    GF_AUTH_GENERIC_OAUTH_AUTO_LOGIN           = "false"
    GF_AUTH_GENERIC_OAUTH_ALLOW_SIGN_UP        = "true"
    GF_AUTH_GENERIC_OAUTH_LOGIN_ATTRIBUTE_PATH = "username"
    GF_AUTH_GENERIC_OAUTH_EMAIL_ATTRIBUTE_PATH = "email"
    GF_AUTH_GENERIC_OAUTH_ROLE_ATTRIBUTE_PATH  = var.grafana_oidc_role_attribute_path
    GF_AUTH_GENERIC_OAUTH_TLS_CLIENT_CA        = "/etc/internal-ca/${local.ca_bundle_key}"
  } : {}

  grafana_mounts = concat(
    [
      { name = "grafana-ini", mountPath = "/etc/grafana-config", configMap = "grafana-ini", readOnly = true },
      { name = "prov-datasources", mountPath = "/etc/grafana/provisioning/datasources/datasources.yaml", subPath = "datasources.yaml", configMap = "grafana-provisioning", readOnly = true },
      { name = "prov-contact-points", mountPath = "/etc/grafana/provisioning/alerting/contact-points.yaml", subPath = "contact-points.yaml", configMap = "grafana-provisioning", readOnly = true },
      { name = "prov-alert-rules", mountPath = "/etc/grafana/provisioning/alerting/rules.yaml", subPath = "rules.yaml", configMap = "grafana-provisioning", readOnly = true },
      { name = "prov-plugins", mountPath = "/etc/grafana/provisioning/plugins/plugins.yaml", subPath = "plugins.yaml", configMap = "grafana-provisioning", readOnly = true },
    ],
    [for f in local.grafana_branding_files : {
      name      = "brand-${replace(replace(lower(f), ".", "-"), "_", "-")}"
      mountPath = "/usr/share/grafana/public/img/${f}"
      subPath   = f
      configMap = "grafana-branding"
      readOnly  = true
    }],
  )

  grafana_secret_mounts = local.grafana_oidc_enabled ? [{
    name       = "internal-ca"
    mountPath  = "/etc/internal-ca"
    secretName = local.ca_bundle_secret
    readOnly   = true
  }] : []

  monitoring_external_secrets = merge(
    {
      "vault-metrics-token" = {
        namespace = local.ns.vault
        template = {
          type = "Opaque"
          data = {
            token = "{{ .token }}"
          }
        }
        data = {
          token = { key = "monitoring/vault-metrics", property = "token" }
        }
      }
    },
    var.loki_object_storage.enabled ? {
      "loki-s3" = {
        namespace = local.mon_ns
        template = {
          type = "Opaque"
          data = {
            AWS_ACCESS_KEY_ID     = "{{ .access_key_id }}"
            AWS_SECRET_ACCESS_KEY = "{{ .secret_access_key }}"
          }
        }
        data = {
          access_key_id     = { key = "monitoring/loki-s3", property = "access_key_id" }
          secret_access_key = { key = "monitoring/loki-s3", property = "secret_access_key" }
        }
      }
    } : {},
  )

  monitoring_external_secret_manifests = {
    for name, es in local.monitoring_external_secrets : name => <<-YAML
      apiVersion: external-secrets.io/v1
      kind: ExternalSecret
      metadata:
        name: ${name}
        namespace: ${es.namespace}
        labels: ${jsonencode(local.common_labels)}
      spec:
        refreshInterval: 1h
        secretStoreRef:
          name: vault
          kind: ClusterSecretStore
        target:
          name: ${name}
          creationPolicy: Owner
          template: ${jsonencode(merge({ engineVersion = "v2" }, es.template))}
        data: ${jsonencode([for key, ref in es.data : { secretKey = key, remoteRef = ref }])}
    YAML
  }

  grafana_certificate_manifest = <<-YAML
    apiVersion: cert-manager.io/v1
    kind: Certificate
    metadata:
      name: grafana-tls
      namespace: ${local.mon_ns}
      labels: ${jsonencode(local.common_labels)}
    spec:
      secretName: grafana-tls
      commonName: ${local.hosts.grafana}
      dnsNames:
        - ${local.hosts.grafana}
      usages:
        - digital signature
        - key encipherment
        - server auth
      privateKey:
        algorithm: ECDSA
        size: 256
        rotationPolicy: Always
      issuerRef:
        name: ${local.public_issuer}
        kind: ClusterIssuer
        group: cert-manager.io
  YAML

  grafana_ingress_route_manifest = <<-YAML
    apiVersion: traefik.io/v1alpha1
    kind: IngressRoute
    metadata:
      name: grafana
      namespace: ${local.mon_ns}
      labels: ${jsonencode(local.common_labels)}
    spec:
      entryPoints:
        - websecure
      routes:
        - match: Host(`${local.hosts.grafana}`)
          kind: Rule
          middlewares:
            - name: admin-chain
              namespace: ${local.ns.traefik}
          services:
            - name: ${local.grafana_service}
              port: 80
      tls:
        secretName: grafana-tls
  YAML

  prometheus_values = {
    crds = { enabled = true }

    defaultRules = {
      create = true
      rules = {
        alertmanager                      = true
        etcd                              = false
        configReloaders                   = true
        general                           = true
        k8sContainerCpuUsageSecondsTotal  = true
        k8sContainerMemoryCache           = true
        k8sContainerMemoryRss             = true
        k8sContainerMemorySwap            = true
        k8sContainerResource              = true
        k8sContainerMemoryWorkingSetBytes = true
        k8sPodOwner                       = true
        kubeApiserverAvailability         = false
        kubeApiserverBurnrate             = false
        kubeApiserverHistogram            = false
        kubeApiserverSlos                 = false
        kubeControllerManager             = false
        kubelet                           = true
        kubeProxy                         = false
        kubePrometheusGeneral             = true
        kubePrometheusNodeRecording       = true
        kubernetesApps                    = false
        kubernetesResources               = false
        kubernetesStorage                 = false
        kubernetesSystem                  = false
        kubeSchedulerAlerting             = false
        kubeSchedulerRecording            = false
        kubeStateMetrics                  = true
        network                           = false
        node                              = true
        nodeExporterAlerting              = false
        nodeExporterRecording             = true
        prometheus                        = true
        prometheusOperator                = true
        windows                           = false
      }
    }

    kubeApiServer         = { enabled = true }
    kubelet               = { enabled = true }
    coreDns               = { enabled = true }
    kubeEtcd              = { enabled = false }
    kubeScheduler         = { enabled = false }
    kubeControllerManager = { enabled = false }
    kubeProxy             = { enabled = false }

    prometheusOperator = {
      admissionWebhooks = { enabled = false }
      resources         = var.monitoring_resources.prometheus_operator
      priorityClassName = "critical"
    }

    kube-state-metrics = {
      resources = var.monitoring_resources.kube_state_metrics
    }

    prometheus-node-exporter = {
      resources = var.monitoring_resources.node_exporter
    }

    alertmanager = {
      enabled        = true
      serviceMonitor = { selfMonitor = false }
      config         = local.alertmanager_config
      alertmanagerSpec = merge({
        replicas          = 1
        retention         = "120h"
        resources         = var.monitoring_resources.alertmanager
        priorityClassName = "critical"
        storage = {
          volumeClaimTemplate = {
            spec = {
              storageClassName = var.storage_class_default
              accessModes      = ["ReadWriteOnce"]
              resources        = { requests = { storage = var.monitoring_storage.alertmanager } }
            }
          }
        }
        }, var.monitoring_alert_webhook_enabled ? {
        secrets = ["alertmanager-webhook"]
      } : {})
    }

    prometheus = {
      serviceMonitor = { selfMonitor = false }
      prometheusSpec = {
        replicas                                = 1
        retention                               = var.monitoring_retention.prometheus_time
        retentionSize                           = var.monitoring_retention.prometheus_size
        scrapeInterval                          = local.compose_prometheus.global.scrape_interval
        evaluationInterval                      = local.compose_prometheus.global.evaluation_interval
        externalLabels                          = merge(local.compose_prometheus.global.external_labels, { cluster = var.cluster_name })
        enableRemoteWriteReceiver               = true
        enableFeatures                          = ["exemplar-storage", "native-histograms"]
        exemplars                               = { maxSize = local.compose_prometheus.storage.exemplars.max_exemplars }
        walCompression                          = true
        ruleSelectorNilUsesHelmValues           = false
        serviceMonitorSelectorNilUsesHelmValues = false
        podMonitorSelectorNilUsesHelmValues     = false
        probeSelectorNilUsesHelmValues          = false
        scrapeConfigSelectorNilUsesHelmValues   = false
        resources                               = var.monitoring_resources.prometheus
        priorityClassName                       = "critical"
        storageSpec = {
          volumeClaimTemplate = {
            spec = {
              storageClassName = var.storage_class_default
              accessModes      = ["ReadWriteOnce"]
              resources        = { requests = { storage = var.monitoring_storage.prometheus } }
            }
          }
        }
      }
    }

    grafana = {
      enabled                   = true
      defaultDashboardsEnabled  = true
      defaultDashboardsTimezone = "browser"
      forceDeployDatasources    = false
      forceDeployDashboards     = false
      admin = {
        existingSecret = "grafana-admin"
        userKey        = "admin-user"
        passwordKey    = "admin-password"
      }
      resources          = var.monitoring_resources.grafana
      rbac               = { namespaced = true }
      deploymentStrategy = { type = "Recreate" }
      serviceMonitor     = { enabled = false }
      persistence = {
        enabled          = true
        type             = "pvc"
        accessModes      = ["ReadWriteOnce"]
        size             = var.monitoring_storage.grafana
        storageClassName = var.storage_class_default
      }
      sidecar = {
        datasources = { enabled = false }
        dashboards = {
          enabled          = true
          label            = "grafana_dashboard"
          labelValue       = "1"
          searchNamespace  = local.mon_ns
          folderAnnotation = "grafana_folder"
          provider         = { foldersFromFilesStructure = true, allowUiUpdates = false, disableDelete = true }
        }
      }
      env = merge({
        GF_PATHS_CONFIG                           = "/etc/grafana-config/grafana.ini"
        GF_SERVER_ROOT_URL                        = "https://${local.hosts.grafana}"
        GF_SECURITY_COOKIE_SECURE                 = "true"
        GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH = "/tmp/dashboards/${local.grafana_folders["time-manager"]}/overview.json"
        }, var.monitoring_alert_webhook_enabled ? {} : {
        GRAFANA_ALERT_WEBHOOK_URL = "${local.alertmanager_url}/-/healthy"
      }, local.grafana_oidc_env)
      envValueFrom = var.monitoring_alert_webhook_enabled ? {
        GRAFANA_ALERT_WEBHOOK_URL = { secretKeyRef = { name = "alertmanager-webhook", key = "url" } }
      } : {}
      envFromSecrets       = local.grafana_oidc_enabled ? [{ name = "grafana-oidc" }] : []
      extraConfigmapMounts = local.grafana_mounts
      extraSecretMounts    = local.grafana_secret_mounts
      containerSecurityContext = {
        allowPrivilegeEscalation = false
        capabilities             = { drop = ["ALL"] }
        seccompProfile           = { type = "RuntimeDefault" }
      }
      testFramework = { enabled = false }
    }
  }
}

resource "kubernetes_config_map_v1" "grafana_ini" {
  metadata {
    name      = "grafana-ini"
    namespace = local.mon_ns
    labels    = local.common_labels
  }

  data = {
    "grafana.ini" = file("${local.obs_dir}/grafana/grafana.ini")
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_config_map_v1" "grafana_provisioning" {
  metadata {
    name      = "grafana-provisioning"
    namespace = local.mon_ns
    labels    = local.common_labels
  }

  data = {
    "datasources.yaml"    = yamlencode(local.grafana_datasources)
    "contact-points.yaml" = file("${local.obs_dir}/grafana/provisioning/alerting/contact-points.yaml")
    "rules.yaml"          = file("${local.obs_dir}/grafana/provisioning/alerting/rules.yaml")
    "plugins.yaml"        = file("${local.obs_dir}/grafana/provisioning/plugins/plugins.yaml")
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_config_map_v1" "grafana_branding" {
  metadata {
    name      = "grafana-branding"
    namespace = local.mon_ns
    labels    = local.common_labels
  }

  binary_data = {
    for f in local.grafana_branding_files : f => filebase64("${local.obs_dir}/grafana/branding/${f}")
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_config_map_v1" "grafana_dashboards" {
  for_each = { for d in local.grafana_dashboard_files : d.key => d }

  metadata {
    name      = "grafana-dashboard-${each.key}"
    namespace = local.mon_ns
    labels    = merge(local.common_labels, { grafana_dashboard = "1" })
    annotations = {
      grafana_folder = each.value.folder
    }
  }

  data = {
    (each.value.file) = file(each.value.path)
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubectl_manifest" "monitoring_external_secret" {
  for_each = local.monitoring_external_secret_manifests

  yaml_body = each.value

  depends_on = [
    kubernetes_namespace_v1.this,
    kubectl_manifest.cluster_secret_store,
  ]
}

resource "helm_release" "kube_prometheus_stack" {
  name       = local.prom_release
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = local.chart_versions["kube-prometheus-stack"]
  namespace  = kubernetes_namespace_v1.this[local.mon_ns].metadata[0].name

  wait    = true
  timeout = 900

  values = [yamlencode(local.prometheus_values)]

  lifecycle {
    precondition {
      condition     = !local.grafana_oidc_enabled || var.features.vault_ui_exposed
      error_message = "features.grafana_oidc needs features.vault_ui_exposed: browsers are redirected to https://${local.hosts.vault} to authorise. What breaks: the Vault login redirect fails and Grafana only offers the admin password. Fix one of: set features.vault_ui_exposed = true; set features.grafana_oidc = false; or expose the Vault hostname through another route."
    }
  }

  depends_on = [
    kubernetes_priority_class_v1.critical,
    kubernetes_config_map_v1.grafana_ini,
    kubernetes_config_map_v1.grafana_provisioning,
    kubernetes_config_map_v1.grafana_branding,
    kubernetes_config_map_v1.grafana_dashboards,
    kubectl_manifest.monitoring_external_secret,
    kubectl_manifest.external_secret,
  ]
}

resource "kubectl_manifest" "grafana_certificate" {
  yaml_body = local.grafana_certificate_manifest

  depends_on = [
    kubernetes_namespace_v1.this,
    kubectl_manifest.vault_pki_issuer,
    kubectl_manifest.letsencrypt_issuer,
    kubectl_manifest.bootstrap_ca_issuer,
  ]
}

resource "kubectl_manifest" "grafana_ingress_route" {
  yaml_body = local.grafana_ingress_route_manifest

  depends_on = [
    helm_release.kube_prometheus_stack,
    helm_release.traefik,
    kubectl_manifest.grafana_certificate,
  ]
}
