locals {
  tls_option_name = var.features.cloudflare_origin_pull ? "modern-origin-pull" : "modern"

  traefik_values = {
    deployment = {
      replicas                      = var.traefik_replicas
      terminationGracePeriodSeconds = 60
    }
    priorityClassName = kubernetes_priority_class_v1.critical.metadata[0].name
    ingressClass = {
      enabled        = true
      isDefaultClass = true
      name           = "traefik"
    }
    providers = {
      kubernetesCRD = {
        enabled                   = true
        allowCrossNamespace       = true
        allowExternalNameServices = false
        ingressClass              = "traefik"
      }
      kubernetesIngress = {
        enabled = false
      }
    }
    gateway = {
      enabled = false
    }
    log = {
      level  = "INFO"
      format = "json"
    }
    accessLog = {
      enabled = true
      format  = "json"
      fields = {
        defaultMode = "keep"
        headers = {
          defaultMode = "drop"
          names = {
            "User-Agent"    = "keep"
            "X-Request-Id"  = "keep"
            "Authorization" = "drop"
            "Cookie"        = "drop"
            "Set-Cookie"    = "drop"
          }
        }
      }
    }
    metrics = {
      prometheus = {
        service = { enabled = true }
      }
    }
    ports = {
      web = merge(
        {
          http = {
            redirections = {
              entryPoint = {
                to        = "websecure"
                scheme    = "https"
                permanent = true
              }
            }
          }
          forwardedHeaders = {
            trustedIPs = var.traefik_trusted_ips
          }
        },
        var.traefik_node_ports.web == null ? {} : { nodePort = var.traefik_node_ports.web },
      )
      websecure = merge(
        {
          http = {
            tls = {
              enabled = true
              options = "${local.tls_option_name}-${local.ns.traefik}@kubernetescrd"
            }
          }
          forwardedHeaders = {
            trustedIPs = var.traefik_trusted_ips
          }
          http3 = { enabled = false }
        },
        var.traefik_node_ports.websecure == null ? {} : { nodePort = var.traefik_node_ports.websecure },
      )
    }
    service = {
      enabled     = true
      annotations = var.traefik_service_annotations
      spec = merge(
        { type = var.traefik_service_type },
        var.traefik_service_type == "LoadBalancer" ? { externalTrafficPolicy = var.traefik_external_traffic_policy } : {},
      )
    }
    podDisruptionBudget = {
      enabled        = true
      maxUnavailable = 1
    }
    resources = {
      requests = { cpu = "100m", memory = "128Mi" }
      limits   = { memory = "512Mi" }
    }
    nodeSelector = var.traefik_node_selector
    topologySpreadConstraints = [{
      maxSkew           = 1
      topologyKey       = "kubernetes.io/hostname"
      whenUnsatisfiable = "ScheduleAnyway"
      labelSelector = {
        matchLabels = {
          "app.kubernetes.io/name" = "traefik"
        }
      }
    }]
    securityContext = {
      allowPrivilegeEscalation = false
      capabilities             = { drop = ["ALL"] }
      readOnlyRootFilesystem   = true
    }
    podSecurityContext = {
      runAsGroup     = 65532
      runAsNonRoot   = true
      runAsUser      = 65532
      seccompProfile = { type = "RuntimeDefault" }
    }
  }
}

resource "helm_release" "traefik" {
  name       = "traefik"
  repository = "https://traefik.github.io/charts"
  chart      = "traefik"
  version    = local.chart_versions["traefik"]
  namespace  = kubernetes_namespace_v1.this[local.ns.traefik].metadata[0].name

  wait            = true
  timeout         = 600
  atomic          = true
  cleanup_on_fail = true

  values = [yamlencode(local.traefik_values)]

  depends_on = [kubernetes_priority_class_v1.critical]
}

data "kubernetes_service_v1" "traefik" {
  metadata {
    name      = "traefik"
    namespace = local.ns.traefik
  }

  depends_on = [helm_release.traefik]
}
