locals {
  vault_server_labels = {
    "app.kubernetes.io/name"     = "vault"
    "app.kubernetes.io/instance" = "vault"
    "component"                  = "server"
  }

  vault_retry_join = join("\n", [
    for i in range(var.vault_replicas) : <<-EOT
      retry_join {
        leader_api_addr     = "https://vault-${i}.vault-internal:8200"
        leader_ca_cert_file = "/vault/userconfig/vault-tls/ca.crt"
      }
    EOT
  ])

  vault_seal_block = var.vault_kms_type == "" ? "" : <<-EOT
    seal "${var.vault_kms_type}" {
    %{for k, v in var.vault_kms_config~}
      ${k} = "${v}"
    %{endfor~}
    }
  EOT

  vault_server_config = <<-EOT
    ui            = true
    disable_mlock = ${var.vault_disable_mlock}
    log_level     = "info"
    log_format    = "json"

    listener "tcp" {
      address         = "[::]:8200"
      cluster_address = "[::]:8201"
      tls_cert_file   = "/vault/userconfig/vault-tls/tls.crt"
      tls_key_file    = "/vault/userconfig/vault-tls/tls.key"
      tls_min_version = "tls12"

      telemetry {
        unauthenticated_metrics_access = false
      }
    }

    storage "raft" {
      path = "/vault/data"
    ${indent(2, local.vault_retry_join)}
    }

    service_registration "kubernetes" {}

    telemetry {
      prometheus_retention_time = "30s"
      disable_hostname          = true
    }

    ${local.vault_seal_block}
  EOT

  vault_values = {
    global = {
      enabled    = true
      tlsDisable = false
    }
    injector = {
      enabled = var.vault_injector_enabled
    }
    server = {
      priorityClassName = kubernetes_priority_class_v1.critical.metadata[0].name
      extraEnvironmentVars = {
        VAULT_CACERT = "/vault/userconfig/vault-tls/ca.crt"
      }
      extraSecretEnvironmentVars = var.vault_extra_secret_env
      volumes = [{
        name   = "vault-tls"
        secret = { secretName = "vault-tls", defaultMode = 288 }
      }]
      volumeMounts = [{
        name      = "vault-tls"
        mountPath = "/vault/userconfig/vault-tls"
        readOnly  = true
      }]
      resources    = var.vault_resources
      nodeSelector = local.data_scheduling.nodeSelector
      tolerations  = local.data_scheduling.tolerations
      dataStorage = {
        enabled      = true
        size         = var.vault_data_size
        storageClass = var.storage_class_retain
      }
      auditStorage = {
        enabled      = true
        size         = var.vault_audit_size
        mountPath    = "/vault/audit"
        storageClass = var.storage_class_retain
      }
      serviceAccount = {
        create      = true
        name        = "vault"
        annotations = var.vault_service_account_annotations
      }
      ha = {
        enabled  = true
        replicas = var.vault_replicas
        raft = {
          enabled      = true
          setNodePeers = true
          config       = local.vault_server_config
        }
        disruptionBudget = {
          enabled        = true
          maxUnavailable = 1
        }
      }
      readinessProbe = { enabled = true }
      livenessProbe = {
        enabled             = true
        initialDelaySeconds = 60
      }
    }
    ui = {
      enabled = true
    }
  }
}

resource "helm_release" "vault" {
  name       = "vault"
  repository = "https://helm.releases.hashicorp.com"
  chart      = "vault"
  version    = local.chart_versions["vault"]
  namespace  = kubernetes_namespace_v1.this[local.ns.vault].metadata[0].name

  wait    = true
  timeout = 900

  values = [yamlencode(local.vault_values)]

  depends_on = [
    kubectl_manifest.vault_listener_certificate,
    kubernetes_priority_class_v1.critical,
  ]
}

resource "kubernetes_cluster_role_binding_v1" "vault_auth_delegator" {
  metadata {
    name   = "vault-server-auth-delegator"
    labels = local.common_labels
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "system:auth-delegator"
  }

  subject {
    kind      = "ServiceAccount"
    name      = "vault"
    namespace = local.ns.vault
  }
}

resource "random_password" "app_secret" {
  for_each = toset(["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "OAUTH_STATE_SECRET", "SEED_ADMIN_PASSWORD"])

  length  = 64
  special = false
}

resource "random_password" "metrics_token" {
  length  = 48
  special = false
}

resource "random_password" "grafana_admin" {
  length  = 24
  special = false
}

locals {
  kv_documents = {
    "app/time-manager" = merge(
      {
        for k, v in random_password.app_secret : k => v.result
      },
      {
        METRICS_TOKEN       = random_password.metrics_token.result
        SEED_ADMIN_EMAIL    = var.seed_admin_email
        WEB_URL             = "https://${local.hosts.web}"
        CORS_ORIGIN         = "https://${local.hosts.web}"
        COOKIE_SECURE       = "true"
        TRUST_PROXY         = "1"
        ALLOW_INSECURE_URLS = "false"
        MIGRATIONS_DIR      = "drizzle"
        LOG_LEVEL           = "info"
      },
      var.app_settings,
    )
    "backup/s3" = {
      access_key_id     = "CHANGE_ME"
      secret_access_key = "CHANGE_ME"
    }
    "monitoring/grafana" = {
      admin_user     = "admin"
      admin_password = random_password.grafana_admin.result
    }
    "monitoring/alertmanager" = {
      webhook_url = "http://alertmanager:9093/-/healthy"
    }
    "monitoring/api-metrics" = {
      token = random_password.metrics_token.result
    }
    "platform/cloudflare" = {
      api_token = "CHANGE_ME"
    }
  }

  kv_document_names = [
    "app/time-manager",
    "backup/s3",
    "monitoring/grafana",
    "monitoring/alertmanager",
    "monitoring/api-metrics",
    "platform/cloudflare",
  ]

  vault_policies = {
    "external-secrets" = <<-EOT
      path "secret/data/databases/postgres" {
        capabilities = ["read"]
      }

      path "secret/data/backup/*" {
        capabilities = ["read"]
      }

      path "secret/data/monitoring/*" {
        capabilities = ["read"]
      }

      path "secret/data/platform/*" {
        capabilities = ["read"]
      }

      path "secret/metadata/*" {
        capabilities = ["list", "read"]
      }
    EOT
    "cert-manager"     = <<-EOT
      path "pki-internal/sign/internal-services" {
        capabilities = ["create", "update"]
      }
    EOT
    "backup"           = <<-EOT
      path "secret/data/databases/postgres" {
        capabilities = ["read"]
      }

      path "secret/data/backup/*" {
        capabilities = ["read"]
      }
    EOT
    "monitoring"       = <<-EOT
      path "secret/data/monitoring/*" {
        capabilities = ["read"]
      }
    EOT
    "operator"         = <<-EOT
      path "secret/data/*" {
        capabilities = ["create", "read", "update", "patch", "list"]
      }

      path "secret/metadata/*" {
        capabilities = ["read", "list"]
      }

      path "transit/keys/*" {
        capabilities = ["create", "read", "update", "list"]
      }

      path "transit/export/*" {
        capabilities = ["deny"]
      }

      path "pki-internal/*" {
        capabilities = ["create", "read", "update", "list"]
      }

      path "pki-root/cert/*" {
        capabilities = ["read", "list"]
      }

      path "sys/policies/acl/*" {
        capabilities = ["read", "list"]
      }

      path "sys/mounts" {
        capabilities = ["read"]
      }

      path "sys/auth" {
        capabilities = ["read"]
      }

      path "sys/storage/raft/*" {
        capabilities = ["read", "list"]
      }
    EOT
  }

  vault_internal_api = "${local.vault_url}/v1"
}

resource "vault_mount" "kv" {
  path        = "secret"
  type        = "kv"
  options     = { version = "2" }
  description = "Time Manager configuration and secrets (KV v2)"

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [helm_release.vault]
}

resource "vault_kv_secret_backend_v2" "kv" {
  mount        = vault_mount.kv.path
  max_versions = 20
  cas_required = false
}

resource "vault_mount" "transit" {
  path        = "transit"
  type        = "transit"
  description = "Envelope encryption key encryption keys"

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [helm_release.vault]
}

resource "vault_mount" "pki_root" {
  path                      = "pki-root"
  type                      = "pki"
  description               = "Root CA"
  default_lease_ttl_seconds = 31536000
  max_lease_ttl_seconds     = 315360000

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [helm_release.vault]
}

resource "vault_mount" "pki_internal" {
  path                      = "pki-internal"
  type                      = "pki"
  description               = "Intermediate CA for internal TLS"
  default_lease_ttl_seconds = 86400
  max_lease_ttl_seconds     = 31536000

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [helm_release.vault]
}

resource "vault_transit_secret_backend_key" "kek" {
  for_each = local.transit_key_names

  backend          = vault_mount.transit.path
  name             = each.value
  type             = "aes256-gcm96"
  exportable       = false
  deletion_allowed = false

  lifecycle {
    prevent_destroy = true
  }
}

resource "vault_pki_secret_backend_root_cert" "root" {
  backend     = vault_mount.pki_root.path
  type        = "internal"
  common_name = var.pki_root_common_name
  ttl         = "87600h"
  key_type    = "ec"
  key_bits    = 256
  issuer_name = "root"

  lifecycle {
    prevent_destroy = true
  }
}

resource "vault_pki_secret_backend_intermediate_cert_request" "internal" {
  backend     = vault_mount.pki_internal.path
  type        = "internal"
  common_name = var.pki_intermediate_common_name
  key_type    = "ec"
  key_bits    = 256
}

resource "vault_pki_secret_backend_root_sign_intermediate" "internal" {
  backend     = vault_mount.pki_root.path
  csr         = vault_pki_secret_backend_intermediate_cert_request.internal.csr
  common_name = var.pki_intermediate_common_name
  ttl         = "8760h"

  depends_on = [vault_pki_secret_backend_root_cert.root]
}

resource "vault_pki_secret_backend_intermediate_set_signed" "internal" {
  backend     = vault_mount.pki_internal.path
  certificate = "${vault_pki_secret_backend_root_sign_intermediate.internal.certificate}\n${vault_pki_secret_backend_root_cert.root.certificate}"

  lifecycle {
    prevent_destroy = true
  }
}

resource "vault_pki_secret_backend_config_issuers" "root" {
  backend                       = vault_mount.pki_root.path
  default                       = vault_pki_secret_backend_root_cert.root.issuer_id
  default_follows_latest_issuer = true
}

resource "vault_pki_secret_backend_config_issuers" "internal" {
  backend                       = vault_mount.pki_internal.path
  default                       = vault_pki_secret_backend_intermediate_set_signed.internal.imported_issuers[0]
  default_follows_latest_issuer = true
}

resource "vault_pki_secret_backend_config_urls" "root" {
  backend                 = vault_mount.pki_root.path
  issuing_certificates    = ["${local.vault_internal_api}/pki-root/ca"]
  crl_distribution_points = ["${local.vault_internal_api}/pki-root/crl"]

  depends_on = [vault_pki_secret_backend_config_issuers.root]
}

resource "vault_pki_secret_backend_config_urls" "internal" {
  backend                 = vault_mount.pki_internal.path
  issuing_certificates    = ["${local.vault_internal_api}/pki-internal/ca"]
  crl_distribution_points = ["${local.vault_internal_api}/pki-internal/crl"]
  ocsp_servers            = ["${local.vault_internal_api}/pki-internal/ocsp"]

  depends_on = [vault_pki_secret_backend_config_issuers.internal]
}

resource "vault_pki_secret_backend_role" "api_server" {
  backend            = vault_mount.pki_internal.path
  name               = "api-server"
  issuer_ref         = "default"
  allowed_domains    = ["api", "api.internal", "localhost", "api.${local.ns.app}", "api.${local.ns.app}.svc", local.api_service_dns, local.hosts.api]
  allow_subdomains   = false
  allow_bare_domains = true
  allow_localhost    = true
  allow_ip_sans      = true
  enforce_hostnames  = true
  key_type           = "ec"
  key_bits           = 256
  ttl                = "86400"
  max_ttl            = "259200"
  server_flag        = true
  client_flag        = true
  generate_lease     = true

  depends_on = [vault_pki_secret_backend_config_issuers.internal]
}

resource "vault_pki_secret_backend_role" "internal_services" {
  backend            = vault_mount.pki_internal.path
  name               = "internal-services"
  issuer_ref         = "default"
  allowed_domains    = ["svc.cluster.local", "cluster.local", "internal", local.app_domain]
  allow_subdomains   = true
  allow_bare_domains = false
  allow_localhost    = false
  allow_ip_sans      = true
  enforce_hostnames  = true
  key_type           = "ec"
  key_bits           = 256
  ttl                = "86400"
  max_ttl            = "259200"
  server_flag        = true
  client_flag        = true
  generate_lease     = true

  depends_on = [vault_pki_secret_backend_config_issuers.internal]
}

resource "vault_audit" "stdout" {
  type = "file"
  path = "stdout"

  options = {
    file_path = "stdout"
  }

  depends_on = [helm_release.vault]
}

resource "vault_audit" "file" {
  for_each = var.vault_audit_file_enabled ? toset(["file"]) : toset([])

  type = "file"
  path = each.key

  options = {
    file_path = "/vault/audit/vault_audit.log"
  }

  depends_on = [vault_audit.stdout]
}

resource "vault_auth_backend" "kubernetes" {
  type = "kubernetes"
  path = local.vault_auth_path

  depends_on = [helm_release.vault]
}

resource "vault_kubernetes_auth_backend_config" "this" {
  backend                = vault_auth_backend.kubernetes.path
  kubernetes_host        = "https://kubernetes.default.svc"
  disable_iss_validation = true
  disable_local_ca_jwt   = false

  depends_on = [kubernetes_cluster_role_binding_v1.vault_auth_delegator]
}

resource "vault_policy" "platform" {
  for_each = local.vault_policies

  name   = each.key
  policy = each.value

  depends_on = [helm_release.vault]
}

resource "vault_kubernetes_auth_backend_role" "cert_manager" {
  backend                          = vault_auth_backend.kubernetes.path
  role_name                        = "cert-manager"
  bound_service_account_names      = ["cert-manager"]
  bound_service_account_namespaces = [local.ns.cert_manager]
  token_policies                   = [vault_policy.platform["cert-manager"].name]
  token_ttl                        = 3600
  token_max_ttl                    = 86400

  depends_on = [vault_kubernetes_auth_backend_config.this]
}

resource "vault_kv_secret_v2" "documents" {
  for_each = toset(local.kv_document_names)

  mount     = vault_mount.kv.path
  name      = each.key
  data_json = jsonencode(local.kv_documents[each.key])

  lifecycle {
    ignore_changes = [data_json]
  }

  depends_on = [vault_kv_secret_backend_v2.kv]
}

resource "vault_identity_oidc_key" "grafana" {
  for_each = var.features.grafana_oidc ? toset(["grafana"]) : toset([])

  name               = each.key
  algorithm          = "RS256"
  rotation_period    = 86400
  verification_ttl   = 172800
  allowed_client_ids = ["*"]

  depends_on = [helm_release.vault]
}

resource "vault_identity_oidc_scope" "grafana" {
  for_each = var.features.grafana_oidc ? {
    profile = "{\"name\": {{identity.entity.name}}, \"preferred_username\": {{identity.entity.name}}}"
    email   = "{\"email\": {{identity.entity.metadata.email}}}"
  } : {}

  name     = each.key
  template = each.value

  depends_on = [helm_release.vault]
}

resource "vault_identity_oidc_client" "grafana" {
  for_each = var.features.grafana_oidc ? toset(["grafana"]) : toset([])

  name             = each.key
  key              = vault_identity_oidc_key.grafana[each.key].name
  redirect_uris    = ["https://${local.hosts.grafana}/login/generic_oauth"]
  assignments      = ["allow_all"]
  id_token_ttl     = 3600
  access_token_ttl = 3600
  client_type      = "confidential"
}

resource "vault_identity_oidc_provider" "grafana" {
  for_each = var.features.grafana_oidc ? toset(["grafana"]) : toset([])

  name               = each.key
  https_enabled      = true
  issuer_host        = local.hosts.vault
  allowed_client_ids = [vault_identity_oidc_client.grafana[each.key].client_id]
  scopes_supported   = [for s in vault_identity_oidc_scope.grafana : s.name]
}

resource "vault_kv_secret_v2" "grafana_oidc" {
  for_each = var.features.grafana_oidc ? toset(["grafana"]) : toset([])

  mount = vault_mount.kv.path
  name  = "monitoring/grafana-oidc"
  data_json = jsonencode({
    client_id     = vault_identity_oidc_client.grafana[each.key].client_id
    client_secret = vault_identity_oidc_client.grafana[each.key].client_secret
  })

  depends_on = [vault_kv_secret_backend_v2.kv]
}

data "kubernetes_secret_v1" "vault_bootstrap_tls" {
  metadata {
    name      = "vault-tls"
    namespace = local.ns.vault
  }

  depends_on = [kubectl_manifest.vault_listener_certificate, helm_release.vault]
}

data "vault_pki_secret_backend_issuers" "root" {
  backend = vault_mount.pki_root.path

  depends_on = [vault_pki_secret_backend_config_issuers.root]
}

data "vault_pki_secret_backend_issuers" "internal" {
  backend = vault_mount.pki_internal.path

  depends_on = [vault_pki_secret_backend_config_issuers.internal]
}

data "vault_pki_secret_backend_issuer" "root" {
  backend    = vault_mount.pki_root.path
  issuer_ref = "default"

  depends_on = [vault_pki_secret_backend_config_issuers.root]
}

data "vault_pki_secret_backend_issuer" "internal" {
  backend    = vault_mount.pki_internal.path
  issuer_ref = "default"

  depends_on = [vault_pki_secret_backend_config_issuers.internal]
}

locals {
  live_ca_pems = distinct(concat(
    [trimspace(data.kubernetes_secret_v1.vault_bootstrap_tls.data["ca.crt"])],
    [for c in data.vault_pki_secret_backend_issuer.internal.ca_chain : trimspace(c)],
    [trimspace(data.vault_pki_secret_backend_issuer.internal.certificate)],
    [trimspace(data.vault_pki_secret_backend_issuer.root.certificate)],
  ))
}

resource "kubernetes_secret_v1" "ca_bundle" {
  for_each = local.ca_bundle_namespaces

  metadata {
    name      = local.ca_bundle_secret
    namespace = kubernetes_namespace_v1.this[each.key].metadata[0].name
    labels    = local.common_labels
  }

  data = {
    (local.ca_bundle_key) = "${join("\n", local.live_ca_pems)}\n"
  }

  lifecycle {
    precondition {
      condition     = length(data.vault_pki_secret_backend_issuers.internal.keys) > 0 && length(data.vault_pki_secret_backend_issuers.root.keys) > 0
      error_message = "A PKI mount holds no issuer, so the CA bundle would be empty and every TLS client would reject Vault and the API. Fix: check vault_pki_secret_backend_root_cert.root and vault_pki_secret_backend_intermediate_set_signed.internal, confirm Vault is unsealed, then apply again."
    }
  }
}

resource "terraform_data" "vault_ready" {
  input = "vault-configured"

  depends_on = [
    vault_kv_secret_v2.documents,
    vault_transit_secret_backend_key.kek,
    vault_pki_secret_backend_role.api_server,
    vault_pki_secret_backend_role.internal_services,
    vault_pki_secret_backend_config_urls.internal,
    vault_pki_secret_backend_config_urls.root,
    vault_kubernetes_auth_backend_role.cert_manager,
    vault_kubernetes_auth_backend_config.this,
    vault_audit.stdout,
    vault_policy.platform,
  ]
}

resource "kubectl_manifest" "vault_ui_certificate" {
  for_each = var.features.vault_ui_exposed ? toset(["vault-ui"]) : toset([])

  yaml_body = <<-YAML
    apiVersion: cert-manager.io/v1
    kind: Certificate
    metadata:
      name: vault-ui
      namespace: ${local.ns.vault}
      labels:
        app.kubernetes.io/managed-by: terraform
    spec:
      secretName: vault-ui-tls
      dnsNames:
        - ${local.hosts.vault}
      issuerRef:
        name: ${local.public_issuer}
        kind: ClusterIssuer
        group: cert-manager.io
  YAML

  depends_on = [kubectl_manifest.letsencrypt_issuer, kubectl_manifest.bootstrap_ca_issuer]
}

resource "kubectl_manifest" "vault_ui_transport" {
  for_each = var.features.vault_ui_exposed ? toset(["vault-ui"]) : toset([])

  yaml_body = <<-YAML
    apiVersion: traefik.io/v1alpha1
    kind: ServersTransport
    metadata:
      name: vault-internal-ca
      namespace: ${local.ns.vault}
      labels:
        app.kubernetes.io/managed-by: terraform
    spec:
      serverName: vault.${local.ns.vault}.svc.cluster.local
      rootCAsSecrets:
        - ${local.ca_bundle_secret}
  YAML

  depends_on = [helm_release.traefik, kubernetes_secret_v1.ca_bundle]
}

resource "kubectl_manifest" "vault_ui_route" {
  for_each = var.features.vault_ui_exposed ? toset(["vault-ui"]) : toset([])

  yaml_body = <<-YAML
    apiVersion: traefik.io/v1alpha1
    kind: IngressRoute
    metadata:
      name: vault-ui
      namespace: ${local.ns.vault}
      labels:
        app.kubernetes.io/managed-by: terraform
    spec:
      entryPoints:
        - websecure
      routes:
        - kind: Rule
          match: Host(`${local.hosts.vault}`)
          middlewares:
            - name: admin-chain
              namespace: ${local.ns.traefik}
          services:
            - name: vault-active
              port: 8200
              scheme: https
              serversTransport: vault-internal-ca
      tls:
        secretName: vault-ui-tls
        options:
          name: modern
          namespace: ${local.ns.traefik}
  YAML

  depends_on = [
    kubectl_manifest.vault_ui_transport,
    kubectl_manifest.vault_ui_certificate,
    kubectl_manifest.traefik_chains,
    kubectl_manifest.traefik_tls_option,
  ]
}
