resource "helm_release" "external_secrets" {
  name       = "external-secrets"
  repository = "https://charts.external-secrets.io"
  chart      = "external-secrets"
  version    = var.chart_versions.external_secrets
  namespace  = kubernetes_namespace_v1.this[local.ns.external_secrets].metadata[0].name

  wait    = true
  timeout = 600

  values = [yamlencode({
    installCRDs = true
    serviceAccount = {
      name = "external-secrets"
    }
    certController = {
      create = true
    }
  })]
}

resource "vault_kubernetes_auth_backend_role" "external_secrets" {
  count = local.vault_config_count

  backend                          = vault_auth_backend.kubernetes[0].path
  role_name                        = "external-secrets"
  bound_service_account_names      = ["external-secrets"]
  bound_service_account_namespaces = [local.ns.external_secrets]
  token_policies                   = [vault_policy.this["external-secrets"].name]
  token_ttl                        = 3600
  token_max_ttl                    = 86400

  depends_on = [vault_kubernetes_auth_backend_config.this]
}

resource "kubectl_manifest" "cluster_secret_store" {
  count = local.vault_config_count

  yaml_body = yamlencode({
    apiVersion = "external-secrets.io/v1"
    kind       = "ClusterSecretStore"
    metadata   = { name = "vault" }
    spec = {
      provider = {
        vault = {
          server  = local.vault_address
          path    = "secret"
          version = "v2"
          caProvider = {
            type      = "Secret"
            name      = "vault-tls"
            key       = "ca.crt"
            namespace = local.ns.vault
          }
          auth = {
            kubernetes = {
              mountPath = "kubernetes"
              role      = "external-secrets"
              serviceAccountRef = {
                name      = "external-secrets"
                namespace = local.ns.external_secrets
              }
            }
          }
        }
      }
    }
  })

  depends_on = [
    helm_release.external_secrets,
    vault_kubernetes_auth_backend_role.external_secrets,
    vault_kv_secret_v2.documents,
  ]
}

locals {
  external_secrets = var.enable_vault_config ? merge(
    {
      postgres-credentials = {
        namespace = local.ns.app
        template = {
          type = "kubernetes.io/basic-auth"
        }
        data = {
          username = { key = "databases/postgres", property = "username" }
          password = { key = "databases/postgres", property = "password" }
        }
      }
      backup-s3 = {
        namespace = local.ns.app
        template = {
          type = "Opaque"
          data = {
            ACCESS_KEY_ID         = "{{ .access_key_id }}"
            ACCESS_SECRET_KEY     = "{{ .secret_access_key }}"
            AWS_ACCESS_KEY_ID     = "{{ .access_key_id }}"
            AWS_SECRET_ACCESS_KEY = "{{ .secret_access_key }}"
          }
        }
        data = {
          access_key_id     = { key = "backup/s3", property = "access_key_id" }
          secret_access_key = { key = "backup/s3", property = "secret_access_key" }
        }
      }
      grafana-admin = {
        namespace = local.ns.observability
        template = {
          type = "Opaque"
          data = {
            admin-user     = "{{ .admin_user }}"
            admin-password = "{{ .admin_password }}"
          }
        }
        data = {
          admin_user     = { key = "monitoring/grafana", property = "admin_user" }
          admin_password = { key = "monitoring/grafana", property = "admin_password" }
        }
      }
      alertmanager-webhook = {
        namespace = local.ns.observability
        template = {
          type = "Opaque"
          data = {
            url = "{{ .webhook_url }}"
          }
        }
        data = {
          webhook_url = { key = "monitoring/alertmanager", property = "webhook_url" }
        }
      }
    },
    var.grafana_oidc_enabled ? {
      grafana-oidc = {
        namespace = local.ns.observability
        template = {
          type = "Opaque"
          data = {
            GF_AUTH_GENERIC_OAUTH_CLIENT_ID     = "{{ .client_id }}"
            GF_AUTH_GENERIC_OAUTH_CLIENT_SECRET = "{{ .client_secret }}"
          }
        }
        data = {
          client_id     = { key = "monitoring/grafana-oidc", property = "client_id" }
          client_secret = { key = "monitoring/grafana-oidc", property = "client_secret" }
        }
      }
    } : {},
  ) : {}
}

resource "kubectl_manifest" "external_secret" {
  for_each = local.external_secrets

  yaml_body = yamlencode({
    apiVersion = "external-secrets.io/v1"
    kind       = "ExternalSecret"
    metadata = {
      name      = each.key
      namespace = each.value.namespace
    }
    spec = {
      refreshInterval = "1h"
      secretStoreRef = {
        name = "vault"
        kind = "ClusterSecretStore"
      }
      target = {
        name           = each.key
        creationPolicy = "Owner"
        template = merge(
          { engineVersion = "v2" },
          each.value.template,
        )
      }
      data = [
        for name, ref in each.value.data : {
          secretKey = name
          remoteRef = {
            key      = ref.key
            property = ref.property
          }
        }
      ]
    }
  })

  depends_on = [
    kubectl_manifest.cluster_secret_store,
    kubernetes_namespace_v1.this,
  ]
}
