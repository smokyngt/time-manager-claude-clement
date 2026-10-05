locals {
  api_service_account  = "time-manager-api"
  api_vault_role       = "time-manager-api"
  snapshot_sa          = "vault-raft-snapshot"
  snapshot_vault_role  = "vault-raft-snapshot"
  api_env_configmap    = "time-manager-api-env"
  vault_ca_bundle_name = "vault-ca-bundle"
  api_service_name     = "time-manager-api"

  transit_actions = flatten([
    for name in values(local.transit_key_names) : [
      { path = "transit/encrypt/${name}", capabilities = ["create", "update"] },
      { path = "transit/decrypt/${name}", capabilities = ["create", "update"] },
      { path = "transit/rewrap/${name}", capabilities = ["create", "update"] },
      { path = "transit/keys/${name}/rotate", capabilities = ["update"] },
      { path = "transit/keys/${name}", capabilities = ["read"] },
    ]
  ])

  policy_app = join("\n", concat(
    [
      "path \"secret/data/app/time-manager\" {\n  capabilities = [\"read\", \"update\"]\n}",
      "path \"secret/data/databases/postgres\" {\n  capabilities = [\"read\"]\n}",
      "path \"pki-internal/issue/api-server\" {\n  capabilities = [\"create\", \"update\"]\n}",
    ],
    [for t in local.transit_actions : "path \"${t.path}\" {\n  capabilities = ${jsonencode(t.capabilities)}\n}"],
  ))

  policy_backup = <<-EOT
    path "secret/data/databases/postgres" {
      capabilities = ["read"]
    }

    path "secret/data/backup/*" {
      capabilities = ["read"]
    }
  EOT

  policy_monitoring = <<-EOT
    path "secret/data/monitoring/*" {
      capabilities = ["read"]
    }
  EOT

  policy_raft_snapshot = <<-EOT
    path "sys/storage/raft/snapshot" {
      capabilities = ["read"]
    }
  EOT

  policy_external_secrets = <<-EOT
    path "secret/data/databases/postgres" {
      capabilities = ["read"]
    }

    path "secret/data/backup/*" {
      capabilities = ["read"]
    }

    path "secret/data/monitoring/*" {
      capabilities = ["read"]
    }

    path "secret/metadata/*" {
      capabilities = ["list", "read"]
    }
  EOT

  policy_operator = <<-EOT
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

  vault_policies = {
    app                 = local.policy_app
    backup              = local.policy_backup
    monitoring          = local.policy_monitoring
    operator            = local.policy_operator
    external-secrets    = local.policy_external_secrets
    vault-raft-snapshot = local.policy_raft_snapshot
  }
}

resource "vault_policy" "this" {
  for_each = var.enable_vault_config ? local.vault_policies : {}

  name   = each.key
  policy = each.value

  depends_on = [helm_release.vault]
}

resource "vault_kubernetes_auth_backend_role" "api" {
  count = local.vault_config_count

  backend                          = vault_auth_backend.kubernetes[0].path
  role_name                        = local.api_vault_role
  bound_service_account_names      = [local.api_service_account]
  bound_service_account_namespaces = [local.ns.app]
  token_policies                   = [vault_policy.this["app"].name]
  token_ttl                        = 3600
  token_max_ttl                    = 86400

  depends_on = [vault_kubernetes_auth_backend_config.this]
}

resource "vault_kubernetes_auth_backend_role" "raft_snapshot" {
  count = local.vault_config_count

  backend                          = vault_auth_backend.kubernetes[0].path
  role_name                        = local.snapshot_vault_role
  bound_service_account_names      = [local.snapshot_sa]
  bound_service_account_namespaces = [local.ns.app]
  token_policies                   = [vault_policy.this["vault-raft-snapshot"].name]
  token_ttl                        = 3600
  token_max_ttl                    = 86400

  depends_on = [vault_kubernetes_auth_backend_config.this]
}

resource "kubernetes_config_map_v1" "api_env" {
  metadata {
    name      = local.api_env_configmap
    namespace = local.ns.app
    labels = {
      "app.kubernetes.io/name"      = "time-manager"
      "app.kubernetes.io/component" = "api"
    }
  }

  data = {
    NODE_ENV              = "production"
    PORT                  = "8000"
    VAULT_AUTH_METHOD     = "kubernetes"
    VAULT_K8S_ROLE        = local.api_vault_role
    VAULT_K8S_MOUNT       = "kubernetes"
    VAULT_URL             = "https://vault.${local.ns.vault}.svc.cluster.local:8200"
    VAULT_CACERT          = "/etc/vault-ca/ca.crt"
    NODE_EXTRA_CA_CERTS   = "/etc/vault-ca/ca.crt"
    VAULT_SECRETS_PATH    = "secret/data/app/time-manager"
    VAULT_DATABASE_PATH   = "secret/data/databases/postgres"
    VAULT_PKI_ENABLED     = tostring(var.api_backend_tls)
    VAULT_PKI_MOUNT       = "pki-internal"
    VAULT_PKI_ROLE        = "api-server"
    VAULT_PKI_COMMON_NAME = "${local.api_service_name}.${local.ns.app}.svc"
    VAULT_PKI_ALT_NAMES   = join(",", [local.api_service_name, "${local.api_service_name}.${local.ns.app}.svc.cluster.local", "localhost"])
    VAULT_PKI_IP_SANS     = "127.0.0.1"
    VAULT_PKI_TTL         = "24h"
  }

  depends_on = [kubernetes_namespace_v1.this]
}

data "kubernetes_secret_v1" "vault_bootstrap_tls" {
  count = local.vault_config_count

  metadata {
    name      = "vault-tls"
    namespace = local.ns.vault
  }

  depends_on = [kubectl_manifest.vault_certificate, helm_release.vault]
}

data "vault_pki_secret_backend_issuers" "root" {
  count = local.vault_config_count

  backend = vault_mount.pki_root[0].path

  depends_on = [vault_pki_secret_backend_config_issuers.root]
}

data "vault_pki_secret_backend_issuers" "internal" {
  count = local.vault_config_count

  backend = vault_mount.pki_internal[0].path

  depends_on = [vault_pki_secret_backend_config_issuers.internal]
}

data "vault_pki_secret_backend_issuer" "root" {
  count = local.vault_config_count

  backend    = vault_mount.pki_root[0].path
  issuer_ref = "default"

  depends_on = [vault_pki_secret_backend_config_issuers.root]
}

data "vault_pki_secret_backend_issuer" "internal" {
  count = local.vault_config_count

  backend    = vault_mount.pki_internal[0].path
  issuer_ref = "default"

  depends_on = [vault_pki_secret_backend_config_issuers.internal]
}

locals {
  live_ca_pems = var.enable_vault_config ? distinct(concat(
    [trimspace(data.kubernetes_secret_v1.vault_bootstrap_tls[0].data["ca.crt"])],
    [for c in data.vault_pki_secret_backend_issuer.internal[0].ca_chain : trimspace(c)],
    [trimspace(data.vault_pki_secret_backend_issuer.internal[0].certificate)],
    [trimspace(data.vault_pki_secret_backend_issuer.root[0].certificate)],
  )) : []
}

resource "kubernetes_secret_v1" "vault_ca_bundle" {
  count = local.vault_config_count

  metadata {
    name      = local.vault_ca_bundle_name
    namespace = local.ns.app
  }

  data = {
    "ca.crt" = "${join("\n", local.live_ca_pems)}\n"
  }

  lifecycle {
    precondition {
      condition     = length(data.vault_pki_secret_backend_issuers.internal[0].keys) > 0 && length(data.vault_pki_secret_backend_issuers.root[0].keys) > 0
      error_message = "PKI mounts hold no issuer; the CA bundle would be empty."
    }
  }
}
