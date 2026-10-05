variable "kubeconfig_path" {
  type    = string
  default = "~/.kube/config"
}

variable "kube_context" {
  type    = string
  default = null
}

variable "vault_address" {
  description = "Address used by the Vault provider (kubectl port-forward -n vault svc/vault 8200:8200)."
  type        = string
  default     = "https://127.0.0.1:8200"
}

variable "vault_ca_cert_file" {
  description = "PEM file of the bootstrap CA that signs the Vault listener certificate."
  type        = string
  default     = ""
}

variable "enable_vault_config" {
  type    = bool
  default = false
}

variable "app_namespace" {
  type    = string
  default = "app"
}

variable "app_host" {
  type = string
}

variable "grafana_host" {
  type = string
}

variable "acme_email" {
  type    = string
  default = ""
}

variable "seed_admin_email" {
  type = string
}

variable "data_node_selector" {
  type    = map(string)
  default = {}
}

variable "data_tolerations" {
  type = list(object({
    key      = string
    operator = optional(string, "Equal")
    value    = optional(string)
    effect   = optional(string)
  }))
  default = []
}

variable "storage_class" {
  type    = string
  default = null
}

variable "vault_kms_type" {
  type    = string
  default = ""
}

variable "vault_kms_config" {
  type    = map(string)
  default = {}
}

variable "vault_service_account_annotations" {
  type    = map(string)
  default = {}
}

variable "grafana_oidc_enabled" {
  type    = bool
  default = false
}

variable "vault_oidc_issuer_host" {
  type    = string
  default = "vault.time-manager.example.com"
}

variable "postgres_backup_destination" {
  type    = string
  default = ""
}

variable "postgres_backup_endpoint_url" {
  type    = string
  default = ""
}

variable "alertmanager_webhook_enabled" {
  type    = bool
  default = false
}

variable "ingress_service_annotations" {
  type    = map(string)
  default = {}
}

variable "kube_api_cidrs" {
  type    = list(string)
  default = ["0.0.0.0/0"]
}
