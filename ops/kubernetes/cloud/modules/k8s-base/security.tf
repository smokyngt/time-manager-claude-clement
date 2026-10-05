locals {
  tls_cipher_suites = [
    "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384",
    "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
    "TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305",
    "TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305",
    "TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256",
    "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256",
  ]

  permissions_policy = "accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()"
}

locals {
  traefik_middlewares = {
    "rate-limit" = {
      rateLimit = {
        average = var.rate_limit.average
        burst   = var.rate_limit.burst
        period  = "1s"
      }
    }
    "rate-limit-login" = {
      rateLimit = {
        average = var.rate_limit.login
        burst   = 5
        period  = "1m"
      }
    }
    "in-flight" = {
      inFlightReq = { amount = 100 }
    }
    "compress" = {
      compress = { minResponseBodyBytes = 1024 }
    }
    "security-headers" = {
      headers = {
        stsSeconds           = 31536000
        stsIncludeSubdomains = true
        stsPreload           = true
        forceSTSHeader       = true
        contentTypeNosniff   = true
        frameDeny            = true
        referrerPolicy       = "strict-origin-when-cross-origin"
        permissionsPolicy    = local.permissions_policy
        customResponseHeaders = {
          "Cross-Origin-Opener-Policy"   = "same-origin"
          "Cross-Origin-Resource-Policy" = "same-origin"
          "X-Powered-By"                 = ""
          "Server"                       = ""
        }
      }
    }
    "admin-allowlist" = {
      ipAllowList = { sourceRange = var.admin_allowed_cidrs }
    }
  }
}

resource "kubectl_manifest" "traefik_middleware" {
  for_each = local.traefik_middlewares

  yaml_body = yamlencode({
    apiVersion = "traefik.io/v1alpha1"
    kind       = "Middleware"
    metadata = {
      name      = each.key
      namespace = local.ns.traefik
      labels    = local.common_labels
    }
    spec = each.value
  })

  depends_on = [helm_release.traefik]
}

resource "kubectl_manifest" "traefik_chains" {
  for_each = {
    "default-chain" = ["security-headers", "rate-limit", "in-flight", "compress"]
    "admin-chain"   = ["admin-allowlist", "security-headers", "rate-limit", "in-flight", "compress"]
  }

  yaml_body = <<-YAML
    apiVersion: traefik.io/v1alpha1
    kind: Middleware
    metadata:
      name: ${each.key}
      namespace: ${local.ns.traefik}
      labels:
        app.kubernetes.io/managed-by: terraform
    spec:
      chain:
        middlewares:
%{for m in each.value~}
          - name: ${m}
%{endfor~}
  YAML

  depends_on = [kubectl_manifest.traefik_middleware]
}

resource "kubernetes_secret_v1" "cloudflare_origin_pull_ca" {
  for_each = var.features.cloudflare_origin_pull ? toset(["cloudflare-origin-pull-ca"]) : toset([])

  metadata {
    name      = each.key
    namespace = local.ns.traefik
    labels    = local.common_labels
  }

  data = {
    "tls.ca" = var.cloudflare_origin_pull_ca_pem
  }

  lifecycle {
    precondition {
      condition     = length(trimspace(var.cloudflare_origin_pull_ca_pem)) > 0
      error_message = "features.cloudflare_origin_pull is true but cloudflare_origin_pull_ca_pem is empty, so Traefik would reject every client certificate and the site would go down. Fixes: paste the Cloudflare Authenticated Origin Pulls CA PEM into cloudflare_origin_pull_ca_pem, or set the feature to false, or put the zone behind a different access control."
    }
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubectl_manifest" "traefik_tls_option" {
  yaml_body = <<-YAML
    apiVersion: traefik.io/v1alpha1
    kind: TLSOption
    metadata:
      name: ${local.tls_option_name}
      namespace: ${local.ns.traefik}
      labels:
        app.kubernetes.io/managed-by: terraform
    spec:
      minVersion: VersionTLS12
      sniStrict: true
      cipherSuites:
%{for c in local.tls_cipher_suites~}
        - ${c}
%{endfor~}
      curvePreferences:
        - CurveP256
        - CurveP384
      alpnProtocols:
        - h2
        - http/1.1
%{if var.features.cloudflare_origin_pull~}
      clientAuth:
        secretNames:
          - cloudflare-origin-pull-ca
        clientAuthType: RequireAndVerifyClientCert
%{endif~}
  YAML

  depends_on = [helm_release.traefik, kubernetes_secret_v1.cloudflare_origin_pull_ca]
}

locals {
  np_any_ns    = { namespace = null, pods = null, cidr = null }
  np_ports_dns = [{ port = "53", protocol = "UDP" }, { port = "53", protocol = "TCP" }]

  vault_pods        = local.vault_server_labels
  cert_manager_pods = { "app.kubernetes.io/instance" = "cert-manager" }
  eso_pods          = { "app.kubernetes.io/instance" = "external-secrets" }
  traefik_pods      = { "app.kubernetes.io/name" = "traefik" }

  np_kube_api_peers = [for c in var.kube_api_cidrs : merge(local.np_any_ns, { cidr = c })]
  np_kube_api_ports = [for p in var.kube_api_ports : { port = tostring(p), protocol = "TCP" }]

  np_default = merge([
    for ns in values(local.ns) : {
      "${ns}/default-deny" = {
        name      = "default-deny"
        namespace = ns
        pods      = {}
        types     = ["Ingress", "Egress"]
        ingress   = []
        egress    = []
      }
      "${ns}/allow-dns-egress" = {
        name      = "allow-dns-egress"
        namespace = ns
        pods      = {}
        types     = ["Egress"]
        ingress   = []
        egress = [{
          peers = [merge(local.np_any_ns, { namespace = "kube-system" })]
          ports = local.np_ports_dns
        }]
      }
    }
  ]...)

  np_platform = {
    "${local.ns.cert_manager}/allow-cert-manager-to-kube-api" = {
      name      = "allow-cert-manager-to-kube-api"
      namespace = local.ns.cert_manager
      pods      = {}
      types     = ["Egress"]
      ingress   = []
      egress    = [{ peers = local.np_kube_api_peers, ports = local.np_kube_api_ports }]
    }
    "${local.ns.cert_manager}/allow-cert-manager-to-vault" = {
      name      = "allow-cert-manager-to-vault"
      namespace = local.ns.cert_manager
      pods      = local.cert_manager_pods
      types     = ["Egress"]
      ingress   = []
      egress = [{
        peers = [merge(local.np_any_ns, { namespace = local.ns.vault, pods = local.vault_pods })]
        ports = [{ port = "8200", protocol = "TCP" }]
      }]
    }
    "${local.ns.cert_manager}/allow-cert-manager-to-acme" = {
      name      = "allow-cert-manager-to-acme"
      namespace = local.ns.cert_manager
      pods      = local.cert_manager_pods
      types     = ["Egress"]
      ingress   = []
      egress = [
        { peers = [merge(local.np_any_ns, { cidr = "0.0.0.0/0" })], ports = [{ port = "443", protocol = "TCP" }] },
        { peers = [merge(local.np_any_ns, { cidr = "0.0.0.0/0" })], ports = local.np_ports_dns },
      ]
    }
    "${local.ns.cert_manager}/allow-kube-api-to-cert-manager-webhook" = {
      name      = "allow-kube-api-to-cert-manager-webhook"
      namespace = local.ns.cert_manager
      pods      = { "app.kubernetes.io/name" = "webhook" }
      types     = ["Ingress"]
      egress    = []
      ingress   = [{ peers = [merge(local.np_any_ns, { cidr = "0.0.0.0/0" })], ports = [{ port = "10250", protocol = "TCP" }] }]
    }
    "${local.ns.cert_manager}/allow-monitoring-to-cert-manager" = {
      name      = "allow-monitoring-to-cert-manager"
      namespace = local.ns.cert_manager
      pods      = {}
      types     = ["Ingress"]
      egress    = []
      ingress   = [{ peers = [merge(local.np_any_ns, { namespace = local.ns.monitoring })], ports = [{ port = "9402", protocol = "TCP" }] }]
    }
    "${local.ns.external_secrets}/allow-eso-to-kube-api" = {
      name      = "allow-eso-to-kube-api"
      namespace = local.ns.external_secrets
      pods      = {}
      types     = ["Egress"]
      ingress   = []
      egress    = [{ peers = local.np_kube_api_peers, ports = local.np_kube_api_ports }]
    }
    "${local.ns.external_secrets}/allow-eso-to-vault" = {
      name      = "allow-eso-to-vault"
      namespace = local.ns.external_secrets
      pods      = local.eso_pods
      types     = ["Egress"]
      ingress   = []
      egress = [{
        peers = [merge(local.np_any_ns, { namespace = local.ns.vault, pods = local.vault_pods })]
        ports = [{ port = "8200", protocol = "TCP" }]
      }]
    }
    "${local.ns.external_secrets}/allow-kube-api-to-eso-webhook" = {
      name      = "allow-kube-api-to-eso-webhook"
      namespace = local.ns.external_secrets
      pods      = { "app.kubernetes.io/name" = "external-secrets-webhook" }
      types     = ["Ingress"]
      egress    = []
      ingress   = [{ peers = [merge(local.np_any_ns, { cidr = "0.0.0.0/0" })], ports = [{ port = "10250", protocol = "TCP" }] }]
    }
    "${local.ns.external_secrets}/allow-monitoring-to-eso" = {
      name      = "allow-monitoring-to-eso"
      namespace = local.ns.external_secrets
      pods      = {}
      types     = ["Ingress"]
      egress    = []
      ingress   = [{ peers = [merge(local.np_any_ns, { namespace = local.ns.monitoring })], ports = [{ port = "8080", protocol = "TCP" }] }]
    }
    "${local.ns.vault}/allow-vault-raft" = {
      name      = "allow-vault-raft"
      namespace = local.ns.vault
      pods      = local.vault_pods
      types     = ["Ingress", "Egress"]
      ingress = [{
        peers = [merge(local.np_any_ns, { pods = local.vault_pods })]
        ports = [{ port = "8200", protocol = "TCP" }, { port = "8201", protocol = "TCP" }]
      }]
      egress = [{
        peers = [merge(local.np_any_ns, { pods = local.vault_pods })]
        ports = [{ port = "8200", protocol = "TCP" }, { port = "8201", protocol = "TCP" }]
      }]
    }
    "${local.ns.vault}/allow-vault-to-kube-api" = {
      name      = "allow-vault-to-kube-api"
      namespace = local.ns.vault
      pods      = local.vault_pods
      types     = ["Egress"]
      ingress   = []
      egress    = [{ peers = local.np_kube_api_peers, ports = local.np_kube_api_ports }]
    }
    "${local.ns.vault}/allow-clients-to-vault" = {
      name      = "allow-clients-to-vault"
      namespace = local.ns.vault
      pods      = local.vault_pods
      types     = ["Ingress"]
      egress    = []
      ingress = [{
        peers = [for n in [local.ns.app, local.ns.databases, local.ns.monitoring, local.ns.backup, local.ns.cert_manager, local.ns.external_secrets, local.ns.linkerd, local.ns.velero] : merge(local.np_any_ns, { namespace = n })]
        ports = [{ port = "8200", protocol = "TCP" }]
      }]
    }
    "${local.ns.traefik}/allow-traefik-ingress" = {
      name      = "allow-traefik-ingress"
      namespace = local.ns.traefik
      pods      = local.traefik_pods
      types     = ["Ingress"]
      egress    = []
      ingress = [
        { peers = [merge(local.np_any_ns, { cidr = "0.0.0.0/0" })], ports = [{ port = "8000", protocol = "TCP" }, { port = "8443", protocol = "TCP" }] },
        { peers = [merge(local.np_any_ns, { namespace = local.ns.monitoring })], ports = [{ port = "9100", protocol = "TCP" }] },
      ]
    }
    "${local.ns.traefik}/allow-traefik-to-kube-api" = {
      name      = "allow-traefik-to-kube-api"
      namespace = local.ns.traefik
      pods      = local.traefik_pods
      types     = ["Egress"]
      ingress   = []
      egress    = [{ peers = local.np_kube_api_peers, ports = local.np_kube_api_ports }]
    }
    "${local.ns.traefik}/allow-traefik-to-backends" = {
      name      = "allow-traefik-to-backends"
      namespace = local.ns.traefik
      pods      = local.traefik_pods
      types     = ["Egress"]
      ingress   = []
      egress = [{
        peers = [for n in [local.ns.app, local.ns.monitoring, local.ns.vault] : merge(local.np_any_ns, { namespace = n })]
        ports = [for p in ["8000", "8080", "3000", "8200"] : { port = p, protocol = "TCP" }]
      }]
    }
  }

  network_policies = merge(local.np_default, local.np_platform)
}

resource "kubernetes_network_policy_v1" "this" {
  for_each = local.network_policies

  metadata {
    name      = each.value.name
    namespace = kubernetes_namespace_v1.this[each.value.namespace].metadata[0].name
    labels    = local.common_labels
  }

  spec {
    pod_selector {
      match_labels = each.value.pods
    }

    policy_types = each.value.types

    dynamic "ingress" {
      for_each = each.value.ingress
      content {
        dynamic "from" {
          for_each = ingress.value.peers
          content {
            dynamic "namespace_selector" {
              for_each = from.value.namespace == null ? [] : [from.value.namespace]
              content {
                match_labels = { "kubernetes.io/metadata.name" = namespace_selector.value }
              }
            }
            dynamic "pod_selector" {
              for_each = from.value.pods == null ? [] : [from.value.pods]
              content {
                match_labels = pod_selector.value
              }
            }
            dynamic "ip_block" {
              for_each = from.value.cidr == null ? [] : [from.value.cidr]
              content {
                cidr = ip_block.value
              }
            }
          }
        }
        dynamic "ports" {
          for_each = ingress.value.ports
          content {
            port     = ports.value.port
            protocol = ports.value.protocol
          }
        }
      }
    }

    dynamic "egress" {
      for_each = each.value.egress
      content {
        dynamic "to" {
          for_each = egress.value.peers
          content {
            dynamic "namespace_selector" {
              for_each = to.value.namespace == null ? [] : [to.value.namespace]
              content {
                match_labels = { "kubernetes.io/metadata.name" = namespace_selector.value }
              }
            }
            dynamic "pod_selector" {
              for_each = to.value.pods == null ? [] : [to.value.pods]
              content {
                match_labels = pod_selector.value
              }
            }
            dynamic "ip_block" {
              for_each = to.value.cidr == null ? [] : [to.value.cidr]
              content {
                cidr = ip_block.value
              }
            }
          }
        }
        dynamic "ports" {
          for_each = egress.value.ports
          content {
            port     = ports.value.port
            protocol = ports.value.protocol
          }
        }
      }
    }
  }
}
