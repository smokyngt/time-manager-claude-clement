locals {
  cert_manager_container_security = {
    allowPrivilegeEscalation = false
    readOnlyRootFilesystem   = true
    capabilities             = { drop = ["ALL"] }
  }

  cert_manager_values = {
    crds = {
      enabled = true
      keep    = true
    }
    replicaCount              = var.cert_manager_replicas
    enableCertificateOwnerRef = true
    global = {
      priorityClassName = kubernetes_priority_class_v1.critical.metadata[0].name
      leaderElection    = { namespace = local.ns.cert_manager }
    }
    extraArgs = [
      "--dns01-recursive-nameservers-only",
      "--dns01-recursive-nameservers=1.1.1.1:53,9.9.9.9:53",
    ]
    podDisruptionBudget = {
      enabled        = true
      maxUnavailable = 1
    }
    securityContext          = { runAsNonRoot = true, seccompProfile = { type = "RuntimeDefault" } }
    containerSecurityContext = local.cert_manager_container_security
    webhook = {
      replicaCount             = var.cert_manager_replicas
      securityContext          = { runAsNonRoot = true, seccompProfile = { type = "RuntimeDefault" } }
      containerSecurityContext = local.cert_manager_container_security
      podDisruptionBudget      = { enabled = true, maxUnavailable = 1 }
    }
    cainjector = {
      replicaCount             = 1
      securityContext          = { runAsNonRoot = true, seccompProfile = { type = "RuntimeDefault" } }
      containerSecurityContext = local.cert_manager_container_security
    }
    startupapicheck = {
      securityContext          = { runAsNonRoot = true, seccompProfile = { type = "RuntimeDefault" } }
      containerSecurityContext = local.cert_manager_container_security
    }
    prometheus = {
      enabled        = true
      servicemonitor = { enabled = false }
    }
  }
}

resource "helm_release" "cert_manager" {
  name       = "cert-manager"
  repository = "https://charts.jetstack.io"
  chart      = "cert-manager"
  version    = local.chart_versions["cert-manager"]
  namespace  = kubernetes_namespace_v1.this[local.ns.cert_manager].metadata[0].name

  wait            = true
  timeout         = 600
  atomic          = true
  cleanup_on_fail = true

  values = [yamlencode(local.cert_manager_values)]

  depends_on = [kubernetes_priority_class_v1.critical]
}

resource "kubernetes_role_v1" "cert_manager_vault_token" {
  metadata {
    name      = "cert-manager-vault-token"
    namespace = local.ns.cert_manager
    labels    = local.common_labels
  }

  rule {
    api_groups     = [""]
    resources      = ["serviceaccounts/token"]
    resource_names = ["cert-manager"]
    verbs          = ["create"]
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_role_binding_v1" "cert_manager_vault_token" {
  metadata {
    name      = "cert-manager-vault-token"
    namespace = local.ns.cert_manager
    labels    = local.common_labels
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role_v1.cert_manager_vault_token.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = "cert-manager"
    namespace = local.ns.cert_manager
  }
}
