locals {
  web_service_name = "time-manager-web"

  ingress_common_annotations = {
    "cert-manager.io/cluster-issuer"                     = local.public_cluster_issuer
    "nginx.ingress.kubernetes.io/ssl-redirect"           = "true"
    "nginx.ingress.kubernetes.io/force-ssl-redirect"     = "true"
    "nginx.ingress.kubernetes.io/proxy-body-size"        = "1m"
    "nginx.ingress.kubernetes.io/limit-rps"              = tostring(var.ingress_rate_limit_rps)
    "nginx.ingress.kubernetes.io/limit-burst-multiplier" = "2"
    "nginx.ingress.kubernetes.io/limit-connections"      = "100"
    "nginx.ingress.kubernetes.io/proxy-read-timeout"     = "60"
    "nginx.ingress.kubernetes.io/proxy-send-timeout"     = "30"
  }

  ingress_api_annotations = merge(
    local.ingress_common_annotations,
    var.api_backend_tls ? {
      "nginx.ingress.kubernetes.io/backend-protocol"      = "HTTPS"
      "nginx.ingress.kubernetes.io/proxy-ssl-verify"      = "on"
      "nginx.ingress.kubernetes.io/proxy-ssl-secret"      = "${local.ns.app}/${local.vault_ca_bundle_name}"
      "nginx.ingress.kubernetes.io/proxy-ssl-name"        = local.api_service_name
      "nginx.ingress.kubernetes.io/proxy-ssl-server-name" = "on"
    } : {},
  )
}

resource "helm_release" "ingress_nginx" {
  name       = "ingress-nginx"
  repository = "https://kubernetes.github.io/ingress-nginx"
  chart      = "ingress-nginx"
  version    = var.chart_versions.ingress_nginx
  namespace  = kubernetes_namespace_v1.this[local.ns.ingress].metadata[0].name

  wait    = true
  timeout = 600

  values = [yamlencode({
    controller = {
      ingressClassResource = {
        name    = var.ingress_class_name
        default = true
      }
      replicaCount = 2
      service = {
        type        = var.ingress_service_type
        annotations = var.ingress_service_annotations
      }
      allowSnippetAnnotations = false
      config = {
        "server-tokens"           = "false"
        "ssl-protocols"           = "TLSv1.2 TLSv1.3"
        "hsts"                    = "true"
        "hsts-max-age"            = "31536000"
        "hsts-include-subdomains" = "true"
        "use-forwarded-headers"   = "false"
        "limit-req-status-code"   = "429"
        "limit-conn-status-code"  = "429"
        "enable-brotli"           = "false"
        "hide-headers"            = "X-Powered-By"
        "add-headers"             = "${local.ns.ingress}/security-headers"
      }
      addHeaders = {
        "X-Content-Type-Options"       = "nosniff"
        "X-Frame-Options"              = "DENY"
        "Referrer-Policy"              = "strict-origin-when-cross-origin"
        "Permissions-Policy"           = "accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()"
        "Cross-Origin-Opener-Policy"   = "same-origin"
        "Cross-Origin-Resource-Policy" = "same-origin"
      }
      topologySpreadConstraints = [{
        maxSkew           = 1
        topologyKey       = "kubernetes.io/hostname"
        whenUnsatisfiable = "ScheduleAnyway"
        labelSelector = {
          matchLabels = {
            "app.kubernetes.io/name"      = "ingress-nginx"
            "app.kubernetes.io/component" = "controller"
          }
        }
      }]
      podSecurityContext = {
        seccompProfile = { type = "RuntimeDefault" }
      }
      metrics = {
        enabled        = true
        serviceMonitor = { enabled = true }
      }
      admissionWebhooks = {
        enabled = true
      }
    }
  })]

  depends_on = [helm_release.prometheus_operator_crds]
}

resource "kubernetes_ingress_v1" "web" {
  metadata {
    name      = "time-manager-web"
    namespace = local.ns.app
    annotations = merge(
      local.ingress_common_annotations,
      { "cert-manager.io/cluster-issuer" = local.public_cluster_issuer },
    )
  }

  spec {
    ingress_class_name = var.ingress_class_name

    tls {
      hosts       = [var.app_host]
      secret_name = "time-manager-tls"
    }

    rule {
      host = var.app_host
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = local.web_service_name
              port {
                number = 8080
              }
            }
          }
        }
      }
    }
  }

  depends_on = [helm_release.ingress_nginx, kubernetes_namespace_v1.this]
}

resource "kubernetes_ingress_v1" "api" {
  metadata {
    name        = "time-manager-api"
    namespace   = local.ns.app
    annotations = local.ingress_api_annotations
  }

  spec {
    ingress_class_name = var.ingress_class_name

    tls {
      hosts       = [var.app_host]
      secret_name = "time-manager-tls"
    }

    rule {
      host = var.app_host
      http {
        dynamic "path" {
          for_each = ["/v1", "/docs"]
          content {
            path      = path.value
            path_type = "Prefix"
            backend {
              service {
                name = local.api_service_name
                port {
                  number = 8000
                }
              }
            }
          }
        }
      }
    }
  }

  depends_on = [helm_release.ingress_nginx, kubernetes_namespace_v1.this]
}

resource "kubernetes_ingress_v1" "api_login" {
  metadata {
    name      = "time-manager-api-login"
    namespace = local.ns.app
    annotations = merge(
      { for k, v in local.ingress_api_annotations : k => v if k != "nginx.ingress.kubernetes.io/limit-rps" },
      {
        "nginx.ingress.kubernetes.io/limit-rpm"              = tostring(var.ingress_login_limit_rpm)
        "nginx.ingress.kubernetes.io/limit-burst-multiplier" = "1"
      },
    )
  }

  spec {
    ingress_class_name = var.ingress_class_name

    tls {
      hosts       = [var.app_host]
      secret_name = "time-manager-tls"
    }

    rule {
      host = var.app_host
      http {
        path {
          path      = "/v1/auth/login"
          path_type = "Exact"
          backend {
            service {
              name = local.api_service_name
              port {
                number = 8000
              }
            }
          }
        }
      }
    }
  }

  depends_on = [helm_release.ingress_nginx, kubernetes_namespace_v1.this]
}

resource "kubernetes_ingress_v1" "grafana" {
  count = local.vault_config_count

  metadata {
    name      = "grafana"
    namespace = local.obs_ns
    annotations = {
      "cert-manager.io/cluster-issuer"           = local.public_cluster_issuer
      "nginx.ingress.kubernetes.io/ssl-redirect" = "true"
      "nginx.ingress.kubernetes.io/limit-rps"    = "10"
    }
  }

  spec {
    ingress_class_name = var.ingress_class_name

    tls {
      hosts       = [var.grafana_host]
      secret_name = "grafana-tls"
    }

    rule {
      host = var.grafana_host
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "grafana"
              port {
                number = 3000
              }
            }
          }
        }
      }
    }
  }

  depends_on = [helm_release.ingress_nginx, helm_release.grafana]
}
