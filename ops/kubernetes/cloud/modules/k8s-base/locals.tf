locals {
  chart_versions = merge(
    {
      "traefik"               = "41.6.1"
      "cert-manager"          = "v1.21.2"
      "vault"                 = "0.34.1"
      "external-secrets"      = "2.11.0"
      "cloudnative-pg"        = "0.29.1"
      "velero"                = "12.0.0"
      "longhorn"              = "1.10.0"
      "kube-prometheus-stack" = "85.0.0"
      "loki"                  = "7.3.0"
      "tempo"                 = "1.24.4"
      "alloy"                 = "1.13.0"
      "prometheus-adapter"    = "5.1.0"
      "vpa"                   = "4.9.0"
      "falco"                 = "6.2.0"
      "kyverno"               = "3.5.0"
      "linkerd-crds"          = "2025.10.1"
      "linkerd-control-plane" = "2025.10.1"
      "linkerd-cni"           = "2025.10.1"
    },
    var.chart_versions,
  )

  app_domain = "${var.tenant}.${var.base_domain}"

  hosts = {
    web     = "app.${local.app_domain}"
    api     = "api.${local.app_domain}"
    grafana = "grafana.${local.app_domain}"
    vault   = "vault.${local.app_domain}"
  }

  ns = {
    vault            = "vault"
    databases        = "databases"
    monitoring       = "monitoring"
    backup           = "backup"
    app              = "app"
    cert_manager     = "cert-manager"
    external_secrets = "external-secrets"
    linkerd          = "linkerd"
    linkerd_cni      = "linkerd-cni"
    traefik          = "traefik"
    falco            = "falco"
    kyverno          = "kyverno"
    velero           = "velero"
    longhorn         = "longhorn-system"
  }

  common_labels = {
    "app.kubernetes.io/part-of"    = "time-manager"
    "app.kubernetes.io/managed-by" = "terraform"
  }

  data_scheduling = {
    nodeSelector = var.data_node_selector
    tolerations  = [for t in var.data_tolerations : { for k, v in t : k => v if v != null }]
  }

  vault_url          = "https://vault.${local.ns.vault}.svc.cluster.local:8200"
  vault_auth_path    = "kubernetes"
  ca_bundle_secret   = "internal-ca"
  ca_bundle_key      = "ca.crt"
  api_service_dns    = "api.${local.ns.app}.svc.cluster.local"
  transit_domains    = ["pii", "content", "hash"]
  transit_key_names  = { for d in local.transit_domains : d => "time-manager-${d}-kek" }
  bootstrap_issuer   = "bootstrap-ca"
  vault_pki_issuer   = "vault-pki-internal"
  public_issuer      = var.public_certificates == "bootstrap-ca" ? "bootstrap-ca" : (var.features.letsencrypt_staging ? "letsencrypt-staging" : "letsencrypt-production")
  ca_bundle_namespaces = toset([
    local.ns.app,
    local.ns.databases,
    local.ns.monitoring,
    local.ns.backup,
    local.ns.traefik,
    local.ns.cert_manager,
    local.ns.velero,
    local.ns.linkerd,
  ])
  pull_secret_namespaces = toset([local.ns.app, local.ns.backup, local.ns.databases])
}
