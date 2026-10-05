resource "kubectl_manifest" "bootstrap_selfsigned_issuer" {
  yaml_body = <<-YAML
    apiVersion: cert-manager.io/v1
    kind: ClusterIssuer
    metadata:
      name: bootstrap-selfsigned
      labels:
        app.kubernetes.io/managed-by: terraform
    spec:
      selfSigned: {}
  YAML

  depends_on = [helm_release.cert_manager]
}

resource "kubectl_manifest" "bootstrap_ca" {
  yaml_body = <<-YAML
    apiVersion: cert-manager.io/v1
    kind: Certificate
    metadata:
      name: bootstrap-ca
      namespace: ${local.ns.cert_manager}
      labels:
        app.kubernetes.io/managed-by: terraform
    spec:
      isCA: true
      commonName: time-manager-bootstrap-ca
      secretName: bootstrap-ca
      duration: 87600h
      renewBefore: 8760h
      privateKey:
        algorithm: ECDSA
        size: 256
      issuerRef:
        name: bootstrap-selfsigned
        kind: ClusterIssuer
        group: cert-manager.io
  YAML

  depends_on = [kubectl_manifest.bootstrap_selfsigned_issuer]
}

resource "kubectl_manifest" "bootstrap_ca_issuer" {
  yaml_body = <<-YAML
    apiVersion: cert-manager.io/v1
    kind: ClusterIssuer
    metadata:
      name: ${local.bootstrap_issuer}
      labels:
        app.kubernetes.io/managed-by: terraform
    spec:
      ca:
        secretName: bootstrap-ca
  YAML

  depends_on = [kubectl_manifest.bootstrap_ca]
}

resource "kubectl_manifest" "vault_listener_certificate" {
  yaml_body = <<-YAML
    apiVersion: cert-manager.io/v1
    kind: Certificate
    metadata:
      name: vault-tls
      namespace: ${local.ns.vault}
      labels:
        app.kubernetes.io/managed-by: terraform
    spec:
      secretName: vault-tls
      commonName: vault.${local.ns.vault}.svc.cluster.local
      duration: 8760h
      renewBefore: 720h
      usages:
        - server auth
        - client auth
        - digital signature
        - key encipherment
      dnsNames:
%{for name in local.vault_dns_names~}
        - "${name}"
%{endfor~}
      ipAddresses:
        - 127.0.0.1
      privateKey:
        algorithm: ECDSA
        size: 256
        rotationPolicy: Always
      issuerRef:
        name: ${local.bootstrap_issuer}
        kind: ClusterIssuer
        group: cert-manager.io
  YAML

  depends_on = [
    kubectl_manifest.bootstrap_ca_issuer,
    kubernetes_namespace_v1.this,
  ]
}

locals {
  vault_dns_names = [
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
  ]

  letsencrypt_issuers = var.public_certificates == "letsencrypt" ? {
    "letsencrypt-production" = "https://acme-v02.api.letsencrypt.org/directory"
    "letsencrypt-staging"    = "https://acme-staging-v02.api.letsencrypt.org/directory"
  } : {}
}

resource "kubectl_manifest" "letsencrypt_issuer" {
  for_each = local.letsencrypt_issuers

  yaml_body = <<-YAML
    apiVersion: cert-manager.io/v1
    kind: ClusterIssuer
    metadata:
      name: ${each.key}
      labels:
        app.kubernetes.io/managed-by: terraform
    spec:
      acme:
        email: ${var.acme_email}
        server: ${each.value}
        privateKeySecretRef:
          name: ${each.key}-account-key
        solvers:
          - dns01:
              cloudflare:
                apiTokenSecretRef:
                  name: cloudflare-api-token
                  key: api-token
            selector:
              dnsZones:
                - ${var.base_domain}
  YAML

  depends_on = [helm_release.cert_manager]
}

resource "kubectl_manifest" "vault_pki_issuer" {
  yaml_body = <<-YAML
    apiVersion: cert-manager.io/v1
    kind: ClusterIssuer
    metadata:
      name: ${local.vault_pki_issuer}
      labels:
        app.kubernetes.io/managed-by: terraform
    spec:
      vault:
        server: ${local.vault_url}
        path: pki-internal/sign/internal-services
        caBundleSecretRef:
          name: ${local.ca_bundle_secret}
          key: ${local.ca_bundle_key}
        auth:
          kubernetes:
            mountPath: /v1/auth/${local.vault_auth_path}
            role: cert-manager
            serviceAccountRef:
              name: cert-manager
  YAML

  depends_on = [
    helm_release.cert_manager,
    kubernetes_role_binding_v1.cert_manager_vault_token,
    kubernetes_secret_v1.ca_bundle,
    terraform_data.vault_ready,
  ]
}
