locals {
  ns = {
    vault            = "vault"
    cert_manager     = "cert-manager"
    external_secrets = "external-secrets"
    observability    = "observability"
    app              = var.app_namespace
    ingress          = "ingress-nginx"
    cnpg             = "cnpg-system"
  }

  namespace_policies = {
    (local.ns.vault)            = { enforce = "baseline", audit = "restricted", warn = "restricted" }
    (local.ns.cert_manager)     = { enforce = "baseline", audit = "restricted", warn = "restricted" }
    (local.ns.external_secrets) = { enforce = "baseline", audit = "restricted", warn = "restricted" }
    (local.ns.observability)    = { enforce = "baseline", audit = "restricted", warn = "restricted" }
    (local.ns.app)              = { enforce = "restricted", audit = "restricted", warn = "restricted" }
    (local.ns.ingress)          = { enforce = "baseline", audit = "restricted", warn = "restricted" }
    (local.ns.cnpg)             = { enforce = "baseline", audit = "restricted", warn = "restricted" }
  }

  data_tolerations = [for t in var.data_tolerations : { for k, v in t : k => v if v != null }]
}

resource "kubernetes_namespace_v1" "this" {
  for_each = local.namespace_policies

  metadata {
    name = each.key
    labels = {
      "app.kubernetes.io/part-of"                  = "time-manager"
      "pod-security.kubernetes.io/enforce"         = each.value.enforce
      "pod-security.kubernetes.io/enforce-version" = "latest"
      "pod-security.kubernetes.io/audit"           = each.value.audit
      "pod-security.kubernetes.io/audit-version"   = "latest"
      "pod-security.kubernetes.io/warn"            = each.value.warn
      "pod-security.kubernetes.io/warn-version"    = "latest"
    }
  }
}
