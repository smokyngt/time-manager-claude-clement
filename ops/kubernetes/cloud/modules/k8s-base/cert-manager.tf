resource "helm_release" "cert_manager" {
  name       = "cert-manager"
  repository = "https://charts.jetstack.io"
  chart      = "cert-manager"
  version    = var.chart_versions.cert_manager
  namespace  = kubernetes_namespace_v1.this[local.ns.cert_manager].metadata[0].name

  wait    = true
  timeout = 600

  values = [yamlencode({
    crds = {
      enabled = true
      keep    = true
    }
    global = {
      leaderElection = { namespace = local.ns.cert_manager }
    }
  })]
}

resource "kubectl_manifest" "bootstrap_selfsigned_issuer" {
  yaml_body = yamlencode({
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata   = { name = "bootstrap-selfsigned" }
    spec       = { selfSigned = {} }
  })

  depends_on = [helm_release.cert_manager]
}

resource "kubectl_manifest" "bootstrap_ca" {
  yaml_body = yamlencode({
    apiVersion = "cert-manager.io/v1"
    kind       = "Certificate"
    metadata = {
      name      = "bootstrap-ca"
      namespace = local.ns.cert_manager
    }
    spec = {
      isCA        = true
      commonName  = "time-manager-bootstrap-ca"
      secretName  = "bootstrap-ca"
      duration    = "87600h"
      renewBefore = "8760h"
      privateKey = {
        algorithm = "ECDSA"
        size      = 256
      }
      issuerRef = {
        name  = "bootstrap-selfsigned"
        kind  = "ClusterIssuer"
        group = "cert-manager.io"
      }
    }
  })

  depends_on = [kubectl_manifest.bootstrap_selfsigned_issuer]
}

resource "kubectl_manifest" "bootstrap_ca_issuer" {
  yaml_body = yamlencode({
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata   = { name = "bootstrap-ca" }
    spec       = { ca = { secretName = "bootstrap-ca" } }
  })

  depends_on = [kubectl_manifest.bootstrap_ca]
}

resource "kubectl_manifest" "acme_issuer" {
  count = var.acme_email == "" ? 0 : 1

  yaml_body = yamlencode({
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata   = { name = "acme" }
    spec = {
      acme = {
        email               = var.acme_email
        server              = var.acme_server
        privateKeySecretRef = { name = "acme-account-key" }
        solvers = [{
          http01 = { ingress = { ingressClassName = var.ingress_class_name } }
        }]
      }
    }
  })

  depends_on = [helm_release.cert_manager]
}

locals {
  public_cluster_issuer = var.acme_email == "" ? "bootstrap-ca" : "acme"

  vault_dns_names = concat(
    [
      "vault",
      "vault.${local.ns.vault}",
      "vault.${local.ns.vault}.svc",
      "vault.${local.ns.vault}.svc.cluster.local",
      "vault-internal",
      "vault-active",
      "vault-active.${local.ns.vault}.svc.cluster.local",
      "vault-standby",
      "vault-standby.${local.ns.vault}.svc.cluster.local",
      "*.vault-internal",
      "*.vault-internal.${local.ns.vault}",
      "*.vault-internal.${local.ns.vault}.svc",
      "*.vault-internal.${local.ns.vault}.svc.cluster.local",
      "localhost",
    ],
  )
}

resource "kubectl_manifest" "vault_certificate" {
  yaml_body = yamlencode({
    apiVersion = "cert-manager.io/v1"
    kind       = "Certificate"
    metadata = {
      name      = "vault-tls"
      namespace = local.ns.vault
    }
    spec = {
      secretName  = "vault-tls"
      commonName  = "vault.${local.ns.vault}.svc.cluster.local"
      dnsNames    = local.vault_dns_names
      ipAddresses = ["127.0.0.1"]
      duration    = "8760h"
      renewBefore = "720h"
      usages      = ["server auth", "client auth", "digital signature", "key encipherment"]
      privateKey = {
        algorithm      = "ECDSA"
        size           = 256
        rotationPolicy = "Always"
      }
      issuerRef = {
        name  = "bootstrap-ca"
        kind  = "ClusterIssuer"
        group = "cert-manager.io"
      }
    }
  })

  depends_on = [
    kubectl_manifest.bootstrap_ca_issuer,
    kubernetes_namespace_v1.this,
  ]
}
