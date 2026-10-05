variable "app_namespace" {
  description = "Namespace of the Time Manager workloads (Pod Security Admission restricted)."
  type        = string
  default     = "app"
}

variable "enable_vault_config" {
  description = "Second phase switch: manage Vault objects, External Secrets resources and the database once Vault is initialised and unsealed."
  type        = bool
  default     = false
}

variable "chart_versions" {
  description = "Pinned Helm chart versions."
  type = object({
    cert_manager     = string
    vault            = string
    external_secrets = string
    cloudnative_pg   = string
    ingress_nginx    = string
    prometheus_crds  = string
    prometheus       = string
    loki             = string
    tempo            = string
    alloy            = string
    grafana          = string
  })
  default = {
    cert_manager     = "v1.21.2"
    vault            = "0.34.1"
    external_secrets = "2.11.0"
    cloudnative_pg   = "0.29.1"
    ingress_nginx    = "4.15.1"
    prometheus_crds  = "32.0.1"
    prometheus       = "29.35.0"
    loki             = "7.3.0"
    tempo            = "1.24.4"
    alloy            = "1.13.0"
    grafana          = "10.5.15"
  }
}

variable "image_tags" {
  description = "Container image tags that mirror docker-compose.observability.yml."
  type = object({
    prometheus   = string
    alertmanager = string
    loki         = string
    tempo        = string
    alloy        = string
    grafana      = string
    postgres     = string
  })
  default = {
    prometheus   = "v3.5.0"
    alertmanager = "v0.28.1"
    loki         = "3.5.5"
    tempo        = "2.8.2"
    alloy        = "v1.10.2"
    grafana      = "12.2.0"
    postgres     = "17"
  }
}

variable "data_node_selector" {
  description = "nodeSelector for stateful platform workloads (Vault, PostgreSQL, observability storage)."
  type        = map(string)
  default     = {}
}

variable "data_tolerations" {
  description = "Tolerations for stateful platform workloads."
  type = list(object({
    key      = string
    operator = optional(string, "Equal")
    value    = optional(string)
    effect   = optional(string)
  }))
  default = []
}

variable "storage_class" {
  description = "StorageClass for persistent volumes; null selects the cluster default."
  type        = string
  default     = null
}

variable "kube_api_cidrs" {
  description = "CIDRs of the Kubernetes API server endpoints reachable from pods."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "vault_replicas" {
  type    = number
  default = 3
}

variable "vault_data_size" {
  type    = string
  default = "20Gi"
}

variable "vault_audit_size" {
  type    = string
  default = "10Gi"
}

variable "vault_audit_file_enabled" {
  description = "Also enable a file audit device on the auditStorage volume next to the stdout device."
  type        = bool
  default     = true
}

variable "vault_injector_enabled" {
  type    = bool
  default = false
}

variable "vault_disable_mlock" {
  type    = bool
  default = true
}

variable "vault_resources" {
  type = object({
    requests = map(string)
    limits   = map(string)
  })
  default = {
    requests = { cpu = "250m", memory = "256Mi" }
    limits   = { memory = "1Gi" }
  }
}

variable "vault_kms_type" {
  description = "Auto-unseal seal type (awskms, gcpckms, azurekeyvault, transit); empty keeps the Shamir seal."
  type        = string
  default     = ""
}

variable "vault_kms_config" {
  description = "Parameters rendered inside the seal block."
  type        = map(string)
  default     = {}
}

variable "vault_extra_secret_env" {
  description = "Environment variables sourced from existing Secrets (KMS credentials)."
  type = list(object({
    envName    = string
    secretName = string
    secretKey  = string
  }))
  default = []
}

variable "vault_service_account_annotations" {
  description = "Annotations on the Vault ServiceAccount (IRSA, Workload Identity)."
  type        = map(string)
  default     = {}
}

variable "vault_allowed_client_namespaces" {
  description = "Namespaces (besides the application namespace) allowed to reach Vault on 8200."
  type        = list(string)
  default     = ["external-secrets", "cert-manager", "observability"]
}

variable "vault_kubernetes_host" {
  type    = string
  default = "https://kubernetes.default.svc"
}

variable "transit_domains" {
  description = "Envelope encryption domains; one Transit KEK per domain."
  type        = list(string)
  default     = ["pii", "content", "hash"]
}

variable "pki_root_common_name" {
  type    = string
  default = "Time Manager Root CA"
}

variable "pki_intermediate_common_name" {
  type    = string
  default = "Time Manager Internal CA"
}

variable "pki_api_allowed_domains" {
  type = list(string)
  default = [
    "api",
    "api.internal",
    "localhost",
    "time-manager-api",
    "time-manager-api.app",
    "time-manager-api.app.svc",
    "time-manager-api.app.svc.cluster.local",
  ]
}

variable "pki_internal_allowed_domains" {
  type    = list(string)
  default = ["svc.cluster.local", "internal"]
}

variable "grafana_oidc_enabled" {
  description = "Create the Vault identity OIDC provider and the grafana client."
  type        = bool
  default     = false
}

variable "grafana_host" {
  type    = string
  default = "grafana.time-manager.example.com"
}

variable "app_host" {
  type    = string
  default = "time-manager.example.com"
}

variable "seed_admin_email" {
  type    = string
  default = "admin@time-manager.example.com"
}

variable "app_settings" {
  description = "Extra non-secret keys merged into the Vault document secret/app/time-manager."
  type        = map(string)
  default     = {}
}

variable "acme_email" {
  description = "Contact email of the ACME issuer; empty disables it."
  type        = string
  default     = ""
}

variable "acme_server" {
  type    = string
  default = "https://acme-v02.api.letsencrypt.org/directory"
}

variable "ingress_class_name" {
  type    = string
  default = "nginx"
}

variable "ingress_service_type" {
  type    = string
  default = "LoadBalancer"
}

variable "ingress_service_annotations" {
  type    = map(string)
  default = {}
}

variable "ingress_rate_limit_rps" {
  type    = number
  default = 30
}

variable "ingress_login_limit_rpm" {
  type    = number
  default = 10
}

variable "api_backend_tls" {
  description = "The API serves HTTPS with a Vault PKI certificate (VAULT_PKI_ENABLED=true)."
  type        = bool
  default     = true
}

variable "postgres_instances" {
  type    = number
  default = 3
}

variable "postgres_database" {
  type    = string
  default = "timemanager"
}

variable "postgres_storage_size" {
  type    = string
  default = "50Gi"
}

variable "postgres_resources" {
  type = object({
    requests = map(string)
    limits   = map(string)
  })
  default = {
    requests = { cpu = "500m", memory = "1Gi" }
    limits   = { memory = "2Gi" }
  }
}

variable "postgres_backup_destination" {
  description = "s3://bucket/prefix for barman base backups and WAL archive; empty disables backups."
  type        = string
  default     = ""
}

variable "postgres_backup_endpoint_url" {
  type    = string
  default = ""
}

variable "postgres_backup_retention" {
  type    = string
  default = "30d"
}

variable "postgres_backup_schedule" {
  description = "Six-field cron (seconds first) of the CloudNativePG ScheduledBackup."
  type        = string
  default     = "0 30 2 * * *"
}

variable "observability_retention" {
  type = object({
    prometheus_time = string
    prometheus_size = string
  })
  default = {
    prometheus_time = "15d"
    prometheus_size = "8GB"
  }
}

variable "observability_storage" {
  type = object({
    prometheus   = string
    alertmanager = string
    loki         = string
    tempo        = string
    grafana      = string
  })
  default = {
    prometheus   = "20Gi"
    alertmanager = "2Gi"
    loki         = "20Gi"
    tempo        = "20Gi"
    grafana      = "5Gi"
  }
}

variable "alertmanager_webhook_enabled" {
  description = "Use the webhook Alertmanager configuration; the URL is read from the ExternalSecret alertmanager-webhook."
  type        = bool
  default     = false
}

variable "grafana_alert_webhook_url" {
  type    = string
  default = "http://alertmanager:9093/-/healthy"
}

variable "vault_oidc_issuer_host" {
  description = "Public host:port browsers use to reach the Vault OIDC provider (Grafana SSO)."
  type        = string
  default     = "vault.time-manager.example.com"
}
