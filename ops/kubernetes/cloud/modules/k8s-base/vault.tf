locals {
  vault_address = "https://vault.${local.ns.vault}.svc.cluster.local:8200"

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
    server = merge(
      {
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
        nodeSelector = var.data_node_selector
        tolerations  = local.data_tolerations
        dataStorage = {
          enabled      = true
          size         = var.vault_data_size
          storageClass = var.storage_class
        }
        auditStorage = {
          enabled      = true
          size         = var.vault_audit_size
          mountPath    = "/vault/audit"
          storageClass = var.storage_class
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
      },
    )
    ui = {
      enabled = true
    }
  }
}

resource "helm_release" "vault" {
  name       = "vault"
  repository = "https://helm.releases.hashicorp.com"
  chart      = "vault"
  version    = var.chart_versions.vault
  namespace  = kubernetes_namespace_v1.this[local.ns.vault].metadata[0].name

  wait    = true
  timeout = 900

  values = [yamlencode(local.vault_values)]

  depends_on = [kubectl_manifest.vault_certificate]
}

resource "kubernetes_cluster_role_binding_v1" "vault_auth_delegator" {
  metadata {
    name = "vault-server-auth-delegator"
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

resource "kubernetes_network_policy_v1" "vault_default_deny" {
  metadata {
    name      = "default-deny"
    namespace = local.ns.vault
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress", "Egress"]
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_network_policy_v1" "vault_dns" {
  metadata {
    name      = "allow-dns"
    namespace = local.ns.vault
  }

  spec {
    pod_selector {}
    policy_types = ["Egress"]

    egress {
      to {
        namespace_selector {
          match_labels = { "kubernetes.io/metadata.name" = "kube-system" }
        }
      }
      ports {
        port     = "53"
        protocol = "UDP"
      }
      ports {
        port     = "53"
        protocol = "TCP"
      }
    }
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_network_policy_v1" "vault_raft_peers" {
  metadata {
    name      = "raft-peers"
    namespace = local.ns.vault
  }

  spec {
    pod_selector {
      match_labels = local.vault_server_labels
    }
    policy_types = ["Ingress", "Egress"]

    ingress {
      from {
        pod_selector {
          match_labels = local.vault_server_labels
        }
      }
      ports {
        port     = "8200"
        protocol = "TCP"
      }
      ports {
        port     = "8201"
        protocol = "TCP"
      }
    }

    egress {
      to {
        pod_selector {
          match_labels = local.vault_server_labels
        }
      }
      ports {
        port     = "8200"
        protocol = "TCP"
      }
      ports {
        port     = "8201"
        protocol = "TCP"
      }
    }
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_network_policy_v1" "vault_cert_manager" {
  metadata {
    name      = "from-cert-manager"
    namespace = local.ns.vault
  }

  spec {
    pod_selector {
      match_labels = local.vault_server_labels
    }
    policy_types = ["Ingress"]

    ingress {
      from {
        namespace_selector {
          match_labels = { "kubernetes.io/metadata.name" = local.ns.cert_manager }
        }
      }
      ports {
        port     = "8200"
        protocol = "TCP"
      }
    }
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_network_policy_v1" "vault_clients" {
  metadata {
    name      = "from-platform-namespaces"
    namespace = local.ns.vault
  }

  spec {
    pod_selector {
      match_labels = local.vault_server_labels
    }
    policy_types = ["Ingress"]

    dynamic "ingress" {
      for_each = toset([for n in var.vault_allowed_client_namespaces : n if n != local.ns.cert_manager])
      content {
        from {
          namespace_selector {
            match_labels = { "kubernetes.io/metadata.name" = ingress.value }
          }
        }
        ports {
          port     = "8200"
          protocol = "TCP"
        }
      }
    }
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_network_policy_v1" "vault_app_and_backup" {
  metadata {
    name      = "from-app-namespace"
    namespace = local.ns.vault
  }

  spec {
    pod_selector {
      match_labels = local.vault_server_labels
    }
    policy_types = ["Ingress"]

    ingress {
      from {
        namespace_selector {
          match_labels = { "kubernetes.io/metadata.name" = local.ns.app }
        }
        pod_selector {
          match_expressions {
            key      = "app.kubernetes.io/component"
            operator = "In"
            values   = ["api", "migration", "vault-raft-snapshot"]
          }
        }
      }
      ports {
        port     = "8200"
        protocol = "TCP"
      }
    }
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_network_policy_v1" "vault_kube_api" {
  metadata {
    name      = "to-kube-api"
    namespace = local.ns.vault
  }

  spec {
    pod_selector {
      match_labels = local.vault_server_labels
    }
    policy_types = ["Egress"]

    egress {
      dynamic "to" {
        for_each = toset(var.kube_api_cidrs)
        content {
          ip_block {
            cidr = to.value
          }
        }
      }
      ports {
        port     = "443"
        protocol = "TCP"
      }
      ports {
        port     = "6443"
        protocol = "TCP"
      }
    }
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_network_policy_v1" "vault_kms" {
  count = var.vault_kms_type == "" ? 0 : 1

  metadata {
    name      = "to-kms"
    namespace = local.ns.vault
  }

  spec {
    pod_selector {
      match_labels = local.vault_server_labels
    }
    policy_types = ["Egress"]

    egress {
      to {
        ip_block {
          cidr = "0.0.0.0/0"
        }
      }
      ports {
        port     = "443"
        protocol = "TCP"
      }
    }
  }

  depends_on = [kubernetes_namespace_v1.this]
}

locals {
  vault_config_count = var.enable_vault_config ? 1 : 0

  vault_internal_url = "${local.vault_address}/v1"

  kv_documents = {
    "app/time-manager" = merge(
      {
        JWT_ACCESS_SECRET   = random_password.jwt_access.result
        JWT_REFRESH_SECRET  = random_password.jwt_refresh.result
        OAUTH_STATE_SECRET  = random_password.oauth_state.result
        METRICS_TOKEN       = random_password.metrics_token.result
        SEED_ADMIN_EMAIL    = var.seed_admin_email
        SEED_ADMIN_PASSWORD = random_password.seed_admin.result
        WEB_URL             = "https://${var.app_host}"
        CORS_ORIGIN         = "https://${var.app_host}"
        COOKIE_SECURE       = "true"
        TRUST_PROXY         = "1"
        ALLOW_INSECURE_URLS = "false"
        MIGRATIONS_DIR      = "drizzle"
        LOG_LEVEL           = "info"
      },
      var.app_settings,
    )
    "databases/postgres" = {
      username = "timemanager"
      password = random_password.postgres.result
      host     = "time-manager-db-rw.${local.ns.app}.svc.cluster.local"
      port     = "5432"
      database = var.postgres_database
    }
    "backup/s3" = {
      access_key_id     = "CHANGE_ME"
      secret_access_key = "CHANGE_ME"
    }
    "monitoring/grafana" = {
      admin_user     = "admin"
      admin_password = random_password.grafana_admin.result
    }
    "monitoring/grafana-oidc" = {
      client_id     = "CHANGE_ME"
      client_secret = "CHANGE_ME"
    }
    "monitoring/alertmanager" = {
      webhook_url = "http://alertmanager:9093/-/healthy"
    }
    "monitoring/api-metrics" = {
      token = random_password.metrics_token.result
    }
  }

  kv_document_names = [
    "app/time-manager",
    "databases/postgres",
    "backup/s3",
    "monitoring/grafana",
    "monitoring/grafana-oidc",
    "monitoring/alertmanager",
    "monitoring/api-metrics",
  ]

  transit_key_names = { for d in var.transit_domains : d => "time-manager-${d}-kek" }
}

resource "random_password" "jwt_access" {
  length  = 64
  special = false
}

resource "random_password" "jwt_refresh" {
  length  = 64
  special = false
}

resource "random_password" "oauth_state" {
  length  = 64
  special = false
}

resource "random_password" "metrics_token" {
  length  = 48
  special = false
}

resource "random_password" "seed_admin" {
  length  = 24
  special = false
}

resource "random_password" "postgres" {
  length  = 32
  special = false
}

resource "random_password" "grafana_admin" {
  length  = 24
  special = false
}

resource "vault_mount" "kv" {
  count = local.vault_config_count

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
  count = local.vault_config_count

  mount        = vault_mount.kv[0].path
  max_versions = 20
  cas_required = false
}

resource "vault_mount" "transit" {
  count = local.vault_config_count

  path        = "transit"
  type        = "transit"
  description = "Envelope encryption key encryption keys"

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [helm_release.vault]
}

resource "vault_mount" "pki_root" {
  count = local.vault_config_count

  path                      = "pki-root"
  type                      = "pki"
  description               = "Offline-style root CA"
  default_lease_ttl_seconds = 31536000
  max_lease_ttl_seconds     = 315360000

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [helm_release.vault]
}

resource "vault_mount" "pki_internal" {
  count = local.vault_config_count

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
  for_each = var.enable_vault_config ? local.transit_key_names : {}

  backend          = vault_mount.transit[0].path
  name             = each.value
  type             = "aes256-gcm96"
  exportable       = false
  deletion_allowed = false

  lifecycle {
    prevent_destroy = true
  }
}

resource "vault_pki_secret_backend_root_cert" "root" {
  count = local.vault_config_count

  backend     = vault_mount.pki_root[0].path
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
  count = local.vault_config_count

  backend     = vault_mount.pki_internal[0].path
  type        = "internal"
  common_name = var.pki_intermediate_common_name
  key_type    = "ec"
  key_bits    = 256
}

resource "vault_pki_secret_backend_root_sign_intermediate" "internal" {
  count = local.vault_config_count

  backend     = vault_mount.pki_root[0].path
  csr         = vault_pki_secret_backend_intermediate_cert_request.internal[0].csr
  common_name = var.pki_intermediate_common_name
  ttl         = "8760h"

  depends_on = [vault_pki_secret_backend_root_cert.root]
}

resource "vault_pki_secret_backend_intermediate_set_signed" "internal" {
  count = local.vault_config_count

  backend     = vault_mount.pki_internal[0].path
  certificate = "${vault_pki_secret_backend_root_sign_intermediate.internal[0].certificate}\n${vault_pki_secret_backend_root_cert.root[0].certificate}"

  lifecycle {
    prevent_destroy = true
  }
}

resource "vault_pki_secret_backend_config_issuers" "root" {
  count = local.vault_config_count

  backend                       = vault_mount.pki_root[0].path
  default                       = vault_pki_secret_backend_root_cert.root[0].issuer_id
  default_follows_latest_issuer = true
}

resource "vault_pki_secret_backend_config_issuers" "internal" {
  count = local.vault_config_count

  backend                       = vault_mount.pki_internal[0].path
  default                       = vault_pki_secret_backend_intermediate_set_signed.internal[0].imported_issuers[0]
  default_follows_latest_issuer = true
}

resource "vault_pki_secret_backend_config_urls" "root" {
  count = local.vault_config_count

  backend                 = vault_mount.pki_root[0].path
  issuing_certificates    = ["${local.vault_internal_url}/pki-root/ca"]
  crl_distribution_points = ["${local.vault_internal_url}/pki-root/crl"]

  depends_on = [vault_pki_secret_backend_config_issuers.root]
}

resource "vault_pki_secret_backend_config_urls" "internal" {
  count = local.vault_config_count

  backend                 = vault_mount.pki_internal[0].path
  issuing_certificates    = ["${local.vault_internal_url}/pki-internal/ca"]
  crl_distribution_points = ["${local.vault_internal_url}/pki-internal/crl"]
  ocsp_servers            = ["${local.vault_internal_url}/pki-internal/ocsp"]

  depends_on = [vault_pki_secret_backend_config_issuers.internal]
}

resource "vault_pki_secret_backend_role" "api_server" {
  count = local.vault_config_count

  backend           = vault_mount.pki_internal[0].path
  name              = "api-server"
  issuer_ref        = "default"
  allowed_domains   = var.pki_api_allowed_domains
  allow_subdomains  = true
  allow_localhost   = true
  allow_ip_sans     = true
  enforce_hostnames = true
  key_type          = "ec"
  key_bits          = 256
  ttl               = "86400"
  max_ttl           = "259200"
  server_flag       = true
  client_flag       = true
  generate_lease    = true

  depends_on = [vault_pki_secret_backend_config_issuers.internal]
}

resource "vault_pki_secret_backend_role" "internal_services" {
  count = local.vault_config_count

  backend           = vault_mount.pki_internal[0].path
  name              = "internal-services"
  issuer_ref        = "default"
  allowed_domains   = var.pki_internal_allowed_domains
  allow_subdomains  = true
  allow_localhost   = false
  allow_ip_sans     = true
  enforce_hostnames = true
  key_type          = "ec"
  key_bits          = 256
  ttl               = "86400"
  max_ttl           = "259200"
  server_flag       = true
  client_flag       = true
  generate_lease    = true

  depends_on = [vault_pki_secret_backend_config_issuers.internal]
}

resource "vault_audit" "stdout" {
  count = local.vault_config_count

  type = "file"
  path = "stdout"

  options = {
    file_path = "stdout"
  }

  depends_on = [helm_release.vault]
}

resource "vault_audit" "file" {
  count = var.enable_vault_config && var.vault_audit_file_enabled ? 1 : 0

  type = "file"
  path = "file"

  options = {
    file_path = "/vault/audit/vault_audit.log"
  }

  depends_on = [vault_audit.stdout]
}

resource "vault_auth_backend" "kubernetes" {
  count = local.vault_config_count

  type = "kubernetes"
  path = "kubernetes"

  depends_on = [helm_release.vault]
}

resource "vault_kubernetes_auth_backend_config" "this" {
  count = local.vault_config_count

  backend                = vault_auth_backend.kubernetes[0].path
  kubernetes_host        = var.vault_kubernetes_host
  disable_iss_validation = true
  disable_local_ca_jwt   = false

  depends_on = [kubernetes_cluster_role_binding_v1.vault_auth_delegator]
}

resource "vault_kv_secret_v2" "documents" {
  for_each = var.enable_vault_config ? toset(local.kv_document_names) : toset([])

  mount     = vault_mount.kv[0].path
  name      = each.key
  data_json = jsonencode(local.kv_documents[each.key])

  lifecycle {
    ignore_changes = [data_json]
  }

  depends_on = [vault_kv_secret_backend_v2.kv]
}

resource "vault_identity_oidc_key" "grafana" {
  count = var.enable_vault_config && var.grafana_oidc_enabled ? 1 : 0

  name               = "grafana"
  algorithm          = "RS256"
  rotation_period    = 86400
  verification_ttl   = 172800
  allowed_client_ids = ["*"]

  depends_on = [helm_release.vault]
}

resource "vault_identity_oidc_scope" "profile" {
  count = var.enable_vault_config && var.grafana_oidc_enabled ? 1 : 0

  name        = "profile"
  template    = "{\"name\": {{identity.entity.name}}, \"preferred_username\": {{identity.entity.name}}}"
  description = "Entity name"

  depends_on = [helm_release.vault]
}

resource "vault_identity_oidc_scope" "email" {
  count = var.enable_vault_config && var.grafana_oidc_enabled ? 1 : 0

  name        = "email"
  template    = "{\"email\": {{identity.entity.metadata.email}}}"
  description = "Entity email metadata"

  depends_on = [helm_release.vault]
}

resource "vault_identity_oidc_client" "grafana" {
  count = var.enable_vault_config && var.grafana_oidc_enabled ? 1 : 0

  name             = "grafana"
  key              = vault_identity_oidc_key.grafana[0].name
  redirect_uris    = ["https://${var.grafana_host}/login/generic_oauth"]
  assignments      = ["allow_all"]
  id_token_ttl     = 3600
  access_token_ttl = 3600
  client_type      = "confidential"
}

resource "vault_identity_oidc_provider" "grafana" {
  count = var.enable_vault_config && var.grafana_oidc_enabled ? 1 : 0

  name          = "grafana"
  https_enabled = true
  issuer_host   = var.vault_oidc_issuer_host
  allowed_client_ids = [
    vault_identity_oidc_client.grafana[0].client_id,
  ]
  scopes_supported = [
    vault_identity_oidc_scope.profile[0].name,
    vault_identity_oidc_scope.email[0].name,
  ]
}
