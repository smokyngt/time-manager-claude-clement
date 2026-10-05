resource "helm_release" "external_secrets" {
  name       = "external-secrets"
  repository = "https://charts.external-secrets.io"
  chart      = "external-secrets"
  version    = local.chart_versions["external-secrets"]
  namespace  = kubernetes_namespace_v1.this[local.ns.external_secrets].metadata[0].name

  wait    = true
  timeout = 600

  values = [yamlencode({
    installCRDs       = true
    replicaCount      = var.eso_replicas
    priorityClassName = kubernetes_priority_class_v1.critical.metadata[0].name
    serviceAccount    = { name = "external-secrets" }
    podDisruptionBudget = {
      enabled        = true
      maxUnavailable = 1
    }
    securityContext = {
      allowPrivilegeEscalation = false
      readOnlyRootFilesystem   = true
      runAsNonRoot             = true
      capabilities             = { drop = ["ALL"] }
      seccompProfile           = { type = "RuntimeDefault" }
    }
    webhook = {
      replicaCount        = var.eso_replicas
      podDisruptionBudget = { enabled = true, maxUnavailable = 1 }
      securityContext = {
        allowPrivilegeEscalation = false
        readOnlyRootFilesystem   = true
        runAsNonRoot             = true
        capabilities             = { drop = ["ALL"] }
        seccompProfile           = { type = "RuntimeDefault" }
      }
    }
    certController = {
      securityContext = {
        allowPrivilegeEscalation = false
        readOnlyRootFilesystem   = true
        runAsNonRoot             = true
        capabilities             = { drop = ["ALL"] }
        seccompProfile           = { type = "RuntimeDefault" }
      }
    }
  })]

  depends_on = [kubernetes_priority_class_v1.critical]
}

resource "vault_kubernetes_auth_backend_role" "external_secrets" {
  backend                          = vault_auth_backend.kubernetes.path
  role_name                        = "external-secrets"
  bound_service_account_names      = ["external-secrets"]
  bound_service_account_namespaces = [local.ns.external_secrets]
  token_policies                   = [vault_policy.platform["external-secrets"].name]
  token_ttl                        = 3600
  token_max_ttl                    = 86400

  depends_on = [vault_kubernetes_auth_backend_config.this]
}

resource "kubectl_manifest" "cluster_secret_store" {
  yaml_body = <<-YAML
    apiVersion: external-secrets.io/v1
    kind: ClusterSecretStore
    metadata:
      name: vault
      labels:
        app.kubernetes.io/managed-by: terraform
    spec:
      provider:
        vault:
          server: ${local.vault_url}
          path: secret
          version: v2
          caProvider:
            type: Secret
            name: vault-tls
            key: ca.crt
            namespace: ${local.ns.vault}
          auth:
            kubernetes:
              mountPath: ${local.vault_auth_path}
              role: external-secrets
              serviceAccountRef:
                name: external-secrets
                namespace: ${local.ns.external_secrets}
  YAML

  depends_on = [
    helm_release.external_secrets,
    vault_kubernetes_auth_backend_role.external_secrets,
    terraform_data.vault_ready,
  ]
}

locals {
  external_secrets = {
    "app/api-metrics-token" = {
      namespace = local.ns.app
      name      = "api-metrics-token"
      type      = "Opaque"
      data      = { token = { key = "monitoring/api-metrics", property = "token" } }
      template  = {}
    }
    "monitoring/api-metrics-token" = {
      namespace = local.ns.monitoring
      name      = "api-metrics-token"
      type      = "Opaque"
      data      = { token = { key = "monitoring/api-metrics", property = "token" } }
      template  = {}
    }
    "backup/postgres-credentials" = {
      namespace = local.ns.backup
      name      = "postgres-credentials"
      type      = "kubernetes.io/basic-auth"
      data = {
        username = { key = "databases/postgres", property = "username" }
        password = { key = "databases/postgres", property = "password" }
      }
      template = {}
    }
    "backup/backup-s3" = {
      namespace = local.ns.backup
      name      = "backup-s3"
      type      = "Opaque"
      data = {
        access_key_id     = { key = "backup/s3", property = "access_key_id" }
        secret_access_key = { key = "backup/s3", property = "secret_access_key" }
      }
      template = {
        ACCESS_KEY_ID         = "{{ .access_key_id }}"
        ACCESS_SECRET_KEY     = "{{ .secret_access_key }}"
        AWS_ACCESS_KEY_ID     = "{{ .access_key_id }}"
        AWS_SECRET_ACCESS_KEY = "{{ .secret_access_key }}"
      }
    }
    "databases/backup-s3" = {
      namespace = local.ns.databases
      name      = "backup-s3"
      type      = "Opaque"
      data = {
        access_key_id     = { key = "backup/s3", property = "access_key_id" }
        secret_access_key = { key = "backup/s3", property = "secret_access_key" }
      }
      template = {
        ACCESS_KEY_ID         = "{{ .access_key_id }}"
        ACCESS_SECRET_KEY     = "{{ .secret_access_key }}"
        AWS_ACCESS_KEY_ID     = "{{ .access_key_id }}"
        AWS_SECRET_ACCESS_KEY = "{{ .secret_access_key }}"
      }
    }
    "velero/velero-credentials" = {
      namespace = local.ns.velero
      name      = "velero-credentials"
      type      = "Opaque"
      data = {
        access_key_id     = { key = "backup/s3", property = "access_key_id" }
        secret_access_key = { key = "backup/s3", property = "secret_access_key" }
      }
      template = {
        cloud = "[default]\naws_access_key_id={{ .access_key_id }}\naws_secret_access_key={{ .secret_access_key }}\n"
      }
    }
    "monitoring/grafana-admin" = {
      namespace = local.ns.monitoring
      name      = "grafana-admin"
      type      = "Opaque"
      data = {
        admin_user     = { key = "monitoring/grafana", property = "admin_user" }
        admin_password = { key = "monitoring/grafana", property = "admin_password" }
      }
      template = {
        admin-user     = "{{ .admin_user }}"
        admin-password = "{{ .admin_password }}"
      }
    }
    "monitoring/alertmanager-webhook" = {
      namespace = local.ns.monitoring
      name      = "alertmanager-webhook"
      type      = "Opaque"
      data      = { webhook_url = { key = "monitoring/alertmanager", property = "webhook_url" } }
      template  = { url = "{{ .webhook_url }}" }
    }
    "cert-manager/cloudflare-api-token" = {
      namespace = local.ns.cert_manager
      name      = "cloudflare-api-token"
      type      = "Opaque"
      data      = { api_token = { key = "platform/cloudflare", property = "api_token" } }
      template  = { "api-token" = "{{ .api_token }}" }
    }
  }

  external_secrets_oidc = var.features.grafana_oidc ? {
    "monitoring/grafana-oidc" = {
      namespace = local.ns.monitoring
      name      = "grafana-oidc"
      type      = "Opaque"
      data = {
        client_id     = { key = "monitoring/grafana-oidc", property = "client_id" }
        client_secret = { key = "monitoring/grafana-oidc", property = "client_secret" }
      }
      template = {
        GF_AUTH_GENERIC_OAUTH_CLIENT_ID     = "{{ .client_id }}"
        GF_AUTH_GENERIC_OAUTH_CLIENT_SECRET = "{{ .client_secret }}"
      }
    }
  } : {}

  external_secrets_all = merge(local.external_secrets, local.external_secrets_oidc)
}

resource "kubectl_manifest" "external_secret" {
  for_each = local.external_secrets_all

  yaml_body = <<-YAML
    apiVersion: external-secrets.io/v1
    kind: ExternalSecret
    metadata:
      name: ${each.value.name}
      namespace: ${each.value.namespace}
      labels:
        app.kubernetes.io/managed-by: terraform
    spec:
      refreshInterval: 1h
      secretStoreRef:
        name: vault
        kind: ClusterSecretStore
      target:
        name: ${each.value.name}
        creationPolicy: Owner
        template:
          engineVersion: v2
          type: ${each.value.type}
%{if length(each.value.template) > 0~}
          data:
%{for k, v in each.value.template~}
            ${k}: ${jsonencode(v)}
%{endfor~}
%{endif~}
      data:
%{for k, ref in each.value.data~}
        - secretKey: ${k}
          remoteRef:
            key: ${ref.key}
            property: ${ref.property}
%{endfor~}
  YAML

  depends_on = [
    kubectl_manifest.cluster_secret_store,
    kubernetes_namespace_v1.this,
  ]
}
