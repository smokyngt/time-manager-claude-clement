locals {
  falco_ns              = local.ns.falco
  kyverno_ns            = local.ns.kyverno
  falco_alertmanager    = "http://${local.alertmanager_service}.${local.mon_ns}.svc.cluster.local:9093"
  falco_feature         = var.features.runtime_security ? toset(["falco"]) : toset([])
  kyverno_feature       = var.features.kyverno ? toset(["kyverno"]) : toset([])
  kyverno_policy_active = var.features.kyverno ? local.kyverno_policy_manifests : {}

  falco_values = {
    tty                  = true
    podPriorityClassName = "critical"
    resources            = var.falco_resources
    nodeSelector         = var.falco_node_selector
    tolerations          = [{ operator = "Exists" }]

    driver = {
      kind       = "modern_ebpf"
      modernEbpf = { leastPrivileged = var.falco_least_privileged }
    }

    collectors = {
      kubernetes = { enabled = true }
    }

    metrics = {
      enabled  = true
      interval = "15m"
    }

    falco = {
      json_output                  = true
      json_include_output_property = true
      json_include_tags_property   = true
      log_level                    = "info"
      webserver = {
        enabled                    = true
        listen_port                = 8765
        prometheus_metrics_enabled = true
      }
    }

    customRules = var.falco_custom_rules

    falcosidekick = {
      enabled           = true
      replicaCount      = 2
      priorityClassName = "critical"
      resources = {
        requests = { cpu = "50m", memory = "64Mi" }
        limits   = { memory = "128Mi" }
      }
      config = {
        alertmanager = {
          hostport        = local.falco_alertmanager
          endpoint        = "/api/v2/alerts"
          minimumpriority = var.falco_minimum_priority
          extralabels     = "component:falco"
          checkcert       = true
        }
      }
    }
  }

  kyverno_container_keys = ["containers", "=(initContainers)"]

  kyverno_image_patterns = join(" | ", distinct(concat(
    ["${var.image_registry}/*", var.wait_vault_image],
    var.kyverno_allowed_registries,
  )))

  kyverno_rule_scope = {
    match   = { any = [{ resources = { kinds = ["Pod"] } }] }
    exclude = { any = [{ resources = { namespaces = var.kyverno_excluded_namespaces } }] }
  }

  kyverno_failure_action = {
    failureAction = "Audit"
    failureActionOverrides = [{
      action     = "Enforce"
      namespaces = var.kyverno_enforce_namespaces
    }]
  }

  kyverno_policies = {
    restrict-image-registries = {
      title       = "Restrict image registries"
      category    = "Supply chain"
      severity    = "high"
      description = "Images must come from the first-party registry (${var.image_registry}) or an approved third-party registry listed in kyverno_allowed_registries."
      rules = [{
        name = "allowed-registries"
        validate = {
          message = "Image registry not allowed. Use ${var.image_registry}/<name>:<tag> or add the registry to kyverno_allowed_registries after review."
          pattern = { spec = { for k in local.kyverno_container_keys : k => [{ image = local.kyverno_image_patterns }] } }
        }
      }]
    }

    require-labels = {
      title       = "Require recommended labels"
      category    = "Operations"
      severity    = "medium"
      description = "Pods carry app.kubernetes.io/name and app.kubernetes.io/part-of so dashboards, alerts and network policies can select them."
      rules = [{
        name = "required-labels"
        validate = {
          message = "The labels app.kubernetes.io/name and app.kubernetes.io/part-of are required."
          pattern = { metadata = { labels = { "app.kubernetes.io/name" = "?*", "app.kubernetes.io/part-of" = "?*" } } }
        }
      }]
    }

    require-resources = {
      title       = "Require resource requests and limits"
      category    = "Reliability"
      severity    = "medium"
      description = "Every container sets cpu and memory requests and a memory limit so the scheduler, the HPA and the autoscaler work with real numbers."
      rules = [{
        name = "requests-and-memory-limit"
        validate = {
          message = "cpu and memory requests and a memory limit are required."
          pattern = {
            spec = { for k in local.kyverno_container_keys : k => [{
              resources = {
                requests = { cpu = "?*", memory = "?*" }
                limits   = { memory = "?*" }
              }
            }] }
          }
        }
      }]
    }

    disallow-latest-tag = {
      title       = "Disallow the latest tag"
      category    = "Supply chain"
      severity    = "medium"
      description = "Images carry an explicit tag or digest and never latest, so rollouts and rollbacks are reproducible."
      rules = [
        {
          name = "require-image-tag"
          validate = {
            message = "Images need an explicit tag or digest."
            pattern = { spec = { for k in local.kyverno_container_keys : k => [{ image = "*:* | *@sha256:*" }] } }
          }
        },
        {
          name = "forbid-latest"
          validate = {
            message = "The latest tag is not allowed."
            pattern = { spec = { for k in local.kyverno_container_keys : k => [{ image = "!*:latest" }] } }
          }
        },
      ]
    }

    require-run-as-non-root = {
      title       = "Require runAsNonRoot"
      category    = "Pod security"
      severity    = "high"
      description = "Containers must not run as root: set runAsNonRoot on the pod or on every container."
      rules = [{
        name = "run-as-non-root"
        validate = {
          message = "runAsNonRoot must be true on the pod or on every container."
          anyPattern = [
            { spec = { securityContext = { runAsNonRoot = true } } },
            { spec = { for k in local.kyverno_container_keys : k => [{ securityContext = { runAsNonRoot = true } }] } },
          ]
        }
      }]
    }

    require-read-only-root-filesystem = {
      title       = "Require a read-only root filesystem"
      category    = "Pod security"
      severity    = "medium"
      description = "Writable paths are explicit emptyDir volumes; the image filesystem stays read-only."
      rules = [{
        name = "read-only-root-filesystem"
        validate = {
          message = "securityContext.readOnlyRootFilesystem must be true; mount an emptyDir for writable paths."
          pattern = { spec = { for k in local.kyverno_container_keys : k => [{ securityContext = { readOnlyRootFilesystem = true } }] } }
        }
      }]
    }

    disallow-privilege-escalation = {
      title       = "Disallow privilege escalation"
      category    = "Pod security"
      severity    = "high"
      description = "Containers set allowPrivilegeEscalation to false."
      rules = [{
        name = "no-privilege-escalation"
        validate = {
          message = "securityContext.allowPrivilegeEscalation must be false."
          pattern = { spec = { for k in local.kyverno_container_keys : k => [{ securityContext = { allowPrivilegeEscalation = false } }] } }
        }
      }]
    }
  }

  kyverno_policy_manifests = { for name, p in local.kyverno_policies : name => <<-YAML
    apiVersion: kyverno.io/v1
    kind: ClusterPolicy
    metadata:
      name: ${name}
      labels: ${jsonencode(local.common_labels)}
      annotations:
        policies.kyverno.io/title: ${jsonencode(p.title)}
        policies.kyverno.io/category: ${jsonencode(p.category)}
        policies.kyverno.io/severity: ${p.severity}
        policies.kyverno.io/subject: Pod
        policies.kyverno.io/description: ${jsonencode(p.description)}
    spec:
      background: true
      emitWarning: true
      failurePolicy: ${var.kyverno_failure_policy}
      webhookTimeoutSeconds: 10
      rules: ${jsonencode([for r in p.rules : merge(local.kyverno_rule_scope, r, { validate = merge(local.kyverno_failure_action, r.validate) })])}
  YAML
  }

  kyverno_values = {
    crds   = { install = true }
    config = { enableDefaultRegistryMutation = false }

    admissionController = {
      replicas          = var.kyverno_replicas.admission
      priorityClassName = "critical"
      container         = { resources = var.kyverno_resources }
      initContainer = {
        resources = {
          requests = { cpu = "10m", memory = "64Mi" }
          limits   = { memory = "256Mi" }
        }
      }
    }

    backgroundController = {
      replicas          = var.kyverno_replicas.background
      priorityClassName = "critical"
      resources         = var.kyverno_resources
    }

    cleanupController = {
      replicas          = var.kyverno_replicas.cleanup
      priorityClassName = "critical"
      resources         = var.kyverno_resources
    }

    reportsController = {
      replicas          = var.kyverno_replicas.reports
      priorityClassName = "critical"
      resources         = var.kyverno_resources
    }
  }

  runtime_pod_monitors_all = {
    falco = {
      enabled   = var.features.runtime_security
      namespace = local.falco_ns
      selector  = { "app.kubernetes.io/name" = "falco" }
      port      = 8765
    }
    falcosidekick = {
      enabled   = var.features.runtime_security
      namespace = local.falco_ns
      selector  = { "app.kubernetes.io/name" = "falcosidekick" }
      port      = 2801
    }
    kyverno = {
      enabled   = var.features.kyverno
      namespace = local.kyverno_ns
      selector  = { "app.kubernetes.io/part-of" = "kyverno" }
      port      = 8000
    }
  }

  runtime_pod_monitors = { for k, t in local.runtime_pod_monitors_all : k => t if t.enabled }

  runtime_pod_monitor_manifests = { for k, t in local.runtime_pod_monitors : k => <<-YAML
    apiVersion: monitoring.coreos.com/v1
    kind: PodMonitor
    metadata:
      name: ${k}
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

  kube_api_peers = [for c in var.kube_api_cidrs : { ipBlock = { cidr = c } }]
  kube_api_ports = [for p in var.kube_api_ports : { port = p, protocol = "TCP" }]

  runtime_network_policies_all = {
    "${local.falco_ns}/allow-falco-intra" = {
      enabled   = var.features.runtime_security
      namespace = local.falco_ns
      spec = {
        podSelector = {}
        policyTypes = ["Ingress", "Egress"]
        ingress     = [{ from = [{ podSelector = {} }] }]
        egress      = [{ to = [{ podSelector = {} }] }]
      }
    }
    "${local.falco_ns}/allow-falco-to-kube-api" = {
      enabled   = var.features.runtime_security
      namespace = local.falco_ns
      spec = {
        podSelector = {}
        policyTypes = ["Egress"]
        egress      = [{ to = local.kube_api_peers, ports = local.kube_api_ports }]
      }
    }
    "${local.falco_ns}/allow-falco-to-rule-registry" = {
      enabled   = var.features.runtime_security
      namespace = local.falco_ns
      spec = {
        podSelector = { matchLabels = { "app.kubernetes.io/name" = "falco" } }
        policyTypes = ["Egress"]
        egress = [{
          to    = [{ ipBlock = { cidr = "0.0.0.0/0", except = local.private_cidrs } }]
          ports = [local.mon_tcp["443"]]
        }]
      }
    }
    "${local.falco_ns}/allow-falcosidekick-to-alertmanager" = {
      enabled   = var.features.runtime_security
      namespace = local.falco_ns
      spec = {
        podSelector = { matchLabels = { "app.kubernetes.io/name" = "falcosidekick" } }
        policyTypes = ["Egress"]
        egress = [{
          to    = [{ namespaceSelector = local.ns_selector.monitoring.namespaceSelector, podSelector = { matchLabels = { "app.kubernetes.io/name" = "alertmanager" } } }]
          ports = [local.mon_tcp["9093"]]
        }]
      }
    }
    "${local.falco_ns}/allow-monitoring-to-falco" = {
      enabled   = var.features.runtime_security
      namespace = local.falco_ns
      spec = {
        podSelector = {}
        policyTypes = ["Ingress"]
        ingress = [{
          from  = [{ namespaceSelector = local.ns_selector.monitoring.namespaceSelector, podSelector = local.prometheus_selector }]
          ports = [local.mon_tcp["8765"], local.mon_tcp["2801"]]
        }]
      }
    }
    "${local.kyverno_ns}/allow-kyverno-intra" = {
      enabled   = var.features.kyverno
      namespace = local.kyverno_ns
      spec = {
        podSelector = {}
        policyTypes = ["Ingress", "Egress"]
        ingress     = [{ from = [{ podSelector = {} }] }]
        egress      = [{ to = [{ podSelector = {} }] }]
      }
    }
    "${local.kyverno_ns}/allow-kyverno-to-kube-api" = {
      enabled   = var.features.kyverno
      namespace = local.kyverno_ns
      spec = {
        podSelector = {}
        policyTypes = ["Egress"]
        egress      = [{ to = local.kube_api_peers, ports = local.kube_api_ports }]
      }
    }
    "${local.kyverno_ns}/allow-kube-api-to-kyverno-webhooks" = {
      enabled   = var.features.kyverno
      namespace = local.kyverno_ns
      spec = {
        podSelector = {}
        policyTypes = ["Ingress"]
        ingress     = [{ from = local.kube_api_peers, ports = [{ port = 9443, protocol = "TCP" }] }]
      }
    }
    "${local.kyverno_ns}/allow-monitoring-to-kyverno" = {
      enabled   = var.features.kyverno
      namespace = local.kyverno_ns
      spec = {
        podSelector = {}
        policyTypes = ["Ingress"]
        ingress = [{
          from  = [{ namespaceSelector = local.ns_selector.monitoring.namespaceSelector, podSelector = local.prometheus_selector }]
          ports = [local.mon_tcp["8000"]]
        }]
      }
    }
  }


  runtime_network_policies = { for k, np in local.runtime_network_policies_all : k => np if np.enabled }

  runtime_network_policy_manifests = { for key, np in local.runtime_network_policies : key => yamlencode({
    apiVersion = "networking.k8s.io/v1"
    kind       = "NetworkPolicy"
    metadata = {
      name      = element(split("/", key), 1)
      namespace = np.namespace
      labels    = local.common_labels
    }
    spec = np.spec
  }) }
}

resource "kubectl_manifest" "runtime_network_policy" {
  for_each = local.runtime_network_policy_manifests

  yaml_body = each.value

  depends_on = [kubernetes_namespace_v1.this]
}

resource "helm_release" "falco" {
  for_each = local.falco_feature

  name       = "falco"
  repository = "https://falcosecurity.github.io/charts"
  chart      = "falco"
  version    = local.chart_versions["falco"]
  namespace  = kubernetes_namespace_v1.this[local.falco_ns].metadata[0].name

  wait    = true
  timeout = 900

  values = [yamlencode(local.falco_values)]

  depends_on = [
    kubernetes_priority_class_v1.critical,
    kubectl_manifest.runtime_network_policy,
    helm_release.kube_prometheus_stack,
  ]
}

resource "helm_release" "kyverno" {
  for_each = local.kyverno_feature

  name       = "kyverno"
  repository = "https://kyverno.github.io/kyverno"
  chart      = "kyverno"
  version    = local.chart_versions["kyverno"]
  namespace  = kubernetes_namespace_v1.this[local.kyverno_ns].metadata[0].name

  wait    = true
  timeout = 900

  values = [yamlencode(local.kyverno_values)]

  depends_on = [
    kubernetes_priority_class_v1.critical,
    kubectl_manifest.runtime_network_policy,
  ]
}

resource "kubectl_manifest" "kyverno_policy" {
  for_each = local.kyverno_policy_active

  yaml_body = each.value

  depends_on = [helm_release.kyverno]
}

resource "kubectl_manifest" "runtime_pod_monitor" {
  for_each = local.runtime_pod_monitor_manifests

  yaml_body = each.value

  depends_on = [
    helm_release.kube_prometheus_stack,
    helm_release.falco,
    helm_release.kyverno,
  ]
}
