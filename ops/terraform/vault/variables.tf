variable "vault_address" {
  type        = string
  description = "Vault API address, for example https://127.0.0.1:8200."
  default     = "https://127.0.0.1:8200"
}

variable "vault_ca_cert_file" {
  type        = string
  description = "Path to the CA bundle trusted for the Vault listener (the bootstrap ca.crt)."
  default     = null
}

variable "vault_skip_tls_verify" {
  type        = bool
  description = "Disable certificate verification. Local experiments only."
  default     = false
}

variable "kv_mount_path" {
  type        = string
  description = "Mount path of the KV v2 engine."
  default     = "secret"
}

variable "transit_mount_path" {
  type        = string
  description = "Mount path of the Transit engine."
  default     = "transit"
}

variable "key_domains" {
  type        = set(string)
  description = "Data domains, one Transit KEK each: time-manager-<domain>-kek."
  default     = ["content", "hash", "pii"]
}

variable "pki_common_name" {
  type        = string
  description = "Common name of the root CA."
  default     = "Time Manager Root CA"
}

variable "pki_organization" {
  type        = string
  description = "Organization placed in the CA subjects."
  default     = "Time Manager"
}

variable "pki_allowed_domains" {
  type        = list(string)
  description = "Names the api-server role may issue for."
  default     = ["api", "api.internal", "localhost"]
}

variable "pki_issuing_url" {
  type        = string
  description = "Base URL used for issuing certificate and CRL distribution points."
  default     = "https://vault:8200/v1"
}

variable "audit_enabled" {
  type        = bool
  description = "Manage the file audit device (stdout). Leave false when init.sh already enabled it, or import it first."
  default     = false
}

variable "grafana_oidc_enabled" {
  type        = bool
  description = "Create the identity OIDC provider and the grafana client."
  default     = false
}

variable "grafana_redirect_uris" {
  type        = list(string)
  description = "Redirect URIs of the grafana OIDC client."
  default     = ["http://localhost:3000/login/generic_oauth"]
}

variable "grafana_user_entity_ids" {
  type        = list(string)
  description = "Identity entity ids allowed to sign in to Grafana."
  default     = []
}

variable "placeholder_documents" {
  type        = set(string)
  description = "KV documents created once with placeholder values; their content is never managed afterwards."
  default     = ["backup/s3", "monitoring/alertmanager", "monitoring/grafana"]
}
