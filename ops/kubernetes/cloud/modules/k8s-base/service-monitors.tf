locals {
  monitor_labels = merge(local.common_labels, { release = var.prometheus_release_label })

  platform_pod_monitors = {
    traefik = {
      namespace = var.monitoring_platform_namespaces.traefik
      selector  = { "app.kubernetes.io/name" = "traefik" }
      port      = 9100
    }
    cert-manager = {
      namespace = var.monitoring_platform_namespaces.cert_manager
      selector  = { "app.kubernetes.io/instance" = "cert-manager" }
      port      = 9402
    }
    external-secrets = {
      namespace = var.monitoring_platform_namespaces.external_secrets
      selector  = { "app.kubernetes.io/instance" = "external-secrets" }
      port      = 8080
    }
    velero = {
      namespace = var.monitoring_platform_namespaces.velero
      selector  = { "app.kubernetes.io/name" = "velero" }
      port      = 8085
    }
  }

  platform_pod_monitor_manifests = { for k, t in local.platform_pod_monitors : k => <<-YAML
    apiVersion: monitoring.coreos.com/v1
    kind: PodMonitor
    metadata:
      name: platform-${k}
      namespace: ${t.namespace}
      labels: ${jsonencode(local.monitor_labels)}
    spec:
      namespaceSelector:
        matchNames:
          - ${t.namespace}
      selector:
        matchLabels: ${jsonencode(t.selector)}
      podMetricsEndpoints:
        - portNumber: ${t.port}
          path: /metrics
          scheme: http
          interval: 30s
          scrapeTimeout: 20s
          relabelings:
            - action: replace
              targetLabel: job
              replacement: ${k}
  YAML
  }

  vault_pod_monitor_manifest = <<-YAML
    apiVersion: monitoring.coreos.com/v1
    kind: PodMonitor
    metadata:
      name: platform-vault
      namespace: ${local.ns.vault}
      labels: ${jsonencode(local.monitor_labels)}
    spec:
      namespaceSelector:
        matchNames:
          - ${local.ns.vault}
      selector:
        matchLabels: ${jsonencode(local.vault_server_labels)}
      podMetricsEndpoints:
        - portNumber: 8200
          path: /v1/sys/metrics
          params:
            format:
              - prometheus
          scheme: https
          interval: 30s
          scrapeTimeout: 20s
          authorization:
            type: Bearer
            credentials:
              name: vault-metrics-token
              key: token
          tlsConfig:
            serverName: vault.${local.ns.vault}.svc.cluster.local
            ca:
              secret:
                name: vault-tls
                key: ca.crt
          relabelings:
            - action: replace
              targetLabel: job
              replacement: vault
  YAML

  velero_network_policy_manifest = <<-YAML
    apiVersion: networking.k8s.io/v1
    kind: NetworkPolicy
    metadata:
      name: allow-monitoring-to-velero
      namespace: ${var.monitoring_platform_namespaces.velero}
      labels: ${jsonencode(local.common_labels)}
    spec:
      podSelector:
        matchLabels: ${jsonencode(local.platform_pod_monitors.velero.selector)}
      policyTypes:
        - Ingress
      ingress:
        - from:
            - namespaceSelector:
                matchLabels:
                  kubernetes.io/metadata.name: ${local.mon_ns}
              podSelector:
                matchLabels: ${jsonencode(var.prometheus_pod_labels)}
          ports:
            - protocol: TCP
              port: ${local.platform_pod_monitors.velero.port}
  YAML
}

resource "kubectl_manifest" "platform_pod_monitor" {
  for_each = local.platform_pod_monitor_manifests

  yaml_body = each.value

  depends_on = [
    helm_release.kube_prometheus_stack,
    kubernetes_namespace_v1.this,
  ]
}

resource "kubectl_manifest" "vault_pod_monitor" {
  yaml_body = local.vault_pod_monitor_manifest

  depends_on = [
    helm_release.kube_prometheus_stack,
    kubectl_manifest.monitoring_external_secret,
    kubernetes_namespace_v1.this,
  ]
}

resource "kubectl_manifest" "velero_network_policy" {
  yaml_body = local.velero_network_policy_manifest

  depends_on = [kubernetes_namespace_v1.this]
}

locals {
  ns_selector = { for k, n in local.ns : k => { namespaceSelector = { matchLabels = { "kubernetes.io/metadata.name" = n } } } }

  prometheus_selector = { matchLabels = var.prometheus_pod_labels }
  grafana_selector    = { matchLabels = { "app.kubernetes.io/name" = "grafana" } }
  alloy_selector      = { matchLabels = var.alloy_pod_labels }

  private_cidrs = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]

  mon_tcp = { for p in [443, 3000, 4191, 4317, 4318, 8000, 8080, 8085, 8200, 8765, 9100, 9153, 9187, 9402, 10250, 2801, 9093] : tostring(p) => { port = p, protocol = "TCP" } }

  scrape_egress_all = [
    { enabled = true, to = [local.ns_selector.traefik], ports = [local.mon_tcp["9100"]] },
    { enabled = true, to = [local.ns_selector.cert_manager], ports = [local.mon_tcp["9402"]] },
    { enabled = true, to = [local.ns_selector.external_secrets], ports = [local.mon_tcp["8080"]] },
    { enabled = true, to = [local.ns_selector.velero], ports = [local.mon_tcp["8085"]] },
    { enabled = true, to = [local.ns_selector.vault], ports = [local.mon_tcp["8200"]] },
    { enabled = true, to = [local.ns_selector.databases], ports = [local.mon_tcp["9187"], local.mon_tcp["8080"]] },
    { enabled = true, to = [local.ns_selector.app], ports = [local.mon_tcp["8000"]] },
    { enabled = true, to = [{ namespaceSelector = { matchLabels = { "kubernetes.io/metadata.name" = "kube-system" } } }], ports = [local.mon_tcp["9153"]] },
    { enabled = true, to = [for n in local.mesh_namespaces : { namespaceSelector = { matchLabels = { "kubernetes.io/metadata.name" = n } } }], ports = [local.mon_tcp["4191"]] },
    { enabled = true, to = [for c in var.kubelet_probe_cidrs : { ipBlock = { cidr = c } }], ports = [local.mon_tcp["10250"], local.mon_tcp["9100"]] },
    { enabled = var.features.runtime_security, to = [local.ns_selector.falco], ports = [local.mon_tcp["8765"], local.mon_tcp["2801"]] },
    { enabled = var.features.kyverno, to = [local.ns_selector.kyverno], ports = [local.mon_tcp["8000"]] },
  ]

  scrape_egress = [for e in local.scrape_egress_all : { to = e.to, ports = e.ports } if e.enabled]

  monitoring_network_policies_all = {
    "allow-monitoring-intra" = {
      enabled = true
      spec = {
        podSelector = {}
        policyTypes = ["Ingress", "Egress"]
        ingress     = [{ from = [{ podSelector = {} }] }]
        egress      = [{ to = [{ podSelector = {} }] }]
      }
    }
    "allow-traefik-to-grafana" = {
      enabled = true
      spec = {
        podSelector = local.grafana_selector
        policyTypes = ["Ingress"]
        ingress = [{
          from  = [{ namespaceSelector = local.ns_selector.traefik.namespaceSelector, podSelector = { matchLabels = var.traefik_pod_labels } }]
          ports = [local.mon_tcp["3000"]]
        }]
      }
    }
    "allow-otlp-clients-to-alloy" = {
      enabled = true
      spec = {
        podSelector = local.alloy_selector
        policyTypes = ["Ingress"]
        ingress = [{
          from  = [local.ns_selector.app]
          ports = [local.mon_tcp["4317"], local.mon_tcp["4318"]]
        }]
      }
    }
    "allow-monitoring-to-kube-api" = {
      enabled = true
      spec = {
        podSelector = {}
        policyTypes = ["Egress"]
        egress = [{
          to    = [for c in var.kube_api_cidrs : { ipBlock = { cidr = c } }]
          ports = [for p in var.kube_api_ports : { port = p, protocol = "TCP" }]
        }]
      }
    }
    "allow-prometheus-to-scrape-targets" = {
      enabled = true
      spec = {
        podSelector = local.prometheus_selector
        policyTypes = ["Egress"]
        egress      = local.scrape_egress
      }
    }
    "allow-alloy-to-probe-targets" = {
      enabled = true
      spec = {
        podSelector = local.alloy_selector
        policyTypes = ["Egress"]
        egress = [{
          to    = [local.ns_selector.app]
          ports = [local.mon_tcp["8000"], local.mon_tcp["8080"]]
        }]
      }
    }
    "allow-monitoring-external-https-egress" = {
      enabled = true
      spec = {
        podSelector = {
          matchExpressions = [{ key = "app.kubernetes.io/name", operator = "In", values = ["loki", "alertmanager", "grafana"] }]
        }
        policyTypes = ["Egress"]
        egress = [{
          to    = [for c in var.monitoring_external_egress_cidrs : { ipBlock = merge({ cidr = c }, c == "0.0.0.0/0" ? { except = local.private_cidrs } : {}) }]
          ports = [local.mon_tcp["443"]]
        }]
      }
    }
    "allow-grafana-to-vault" = {
      enabled = var.features.grafana_oidc
      spec = {
        podSelector = local.grafana_selector
        policyTypes = ["Egress"]
        egress = [{
          to    = [{ namespaceSelector = local.ns_selector.vault.namespaceSelector, podSelector = { matchLabels = local.vault_server_labels } }]
          ports = [local.mon_tcp["8200"]]
        }]
      }
    }
    "allow-falcosidekick-to-alertmanager" = {
      enabled = var.features.runtime_security
      spec = {
        podSelector = { matchLabels = { "app.kubernetes.io/name" = "alertmanager" } }
        policyTypes = ["Ingress"]
        ingress = [{
          from  = [{ namespaceSelector = local.ns_selector.falco.namespaceSelector, podSelector = { matchLabels = { "app.kubernetes.io/name" = "falcosidekick" } } }]
          ports = [local.mon_tcp["9093"]]
        }]
      }
    }
  }

  monitoring_network_policies = { for name, np in local.monitoring_network_policies_all : name => np.spec if np.enabled }

  monitoring_network_policy_manifests = { for name, spec in local.monitoring_network_policies : name => yamlencode({
    apiVersion = "networking.k8s.io/v1"
    kind       = "NetworkPolicy"
    metadata = {
      name      = name
      namespace = local.mon_ns
      labels    = local.common_labels
    }
    spec = spec
  }) }
}

resource "kubectl_manifest" "monitoring_network_policy" {
  for_each = local.monitoring_network_policy_manifests

  yaml_body = each.value

  depends_on = [kubernetes_namespace_v1.this]
}
