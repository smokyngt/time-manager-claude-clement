variable "cluster_name" {
  type    = string
  default = "time-manager"
}

variable "node_image" {
  description = "kindest/node image, pinned."
  type        = string
  default     = "kindest/node:v1.32.2"
}

variable "tenant" {
  type    = string
  default = "dev"
}

variable "base_domain" {
  description = "Domain that resolves to 127.0.0.1 (localtest.me or nip.io style)."
  type        = string
  default     = "localtest.me"
}

variable "image_registry" {
  type    = string
  default = "ghcr.io/smokyngt/time-manager-claude-clement"
}

variable "app_workers" {
  type    = number
  default = 2
}

variable "data_workers" {
  type    = number
  default = 3

  validation {
    condition     = var.data_workers >= 3
    error_message = "data_workers must be 3 or more: Vault and PostgreSQL spread three replicas over distinct nodes and stay Pending otherwise. Fixes: raise data_workers; set vault_replicas to 1 and the PostgreSQL instances to 1; or drop the data taint."
  }
}

variable "http_host_port" {
  type    = number
  default = 80
}

variable "https_host_port" {
  type    = number
  default = 443
}

variable "vault_address" {
  type    = string
  default = "https://127.0.0.1:8200"
}

variable "vault_ca_cert_file" {
  type    = string
  default = ""
}

variable "acme_email" {
  type    = string
  default = "dev@example.com"
}

variable "seed_admin_email" {
  type    = string
  default = "admin@example.com"
}

variable "features" {
  type = object({
    restore_jobs           = optional(bool, false)
    longhorn_backup        = optional(bool, false)
    runtime_security       = optional(bool, false)
    kyverno                = optional(bool, false)
    microsoft_egress       = optional(bool, false)
    grafana_oidc           = optional(bool, false)
    letsencrypt_staging    = optional(bool, false)
    vault_ui_exposed       = optional(bool, false)
    cloudflare_origin_pull = optional(bool, false)
  })
  default = {}
}

variable "chart_versions" {
  type    = map(string)
  default = {}
}

variable "vault_backup_passphrase" {
  type      = string
  default   = null
  sensitive = true
}

variable "backup_s3_bucket" {
  type    = string
  default = "time-manager-backups"
}

variable "backup_s3_endpoint" {
  type    = string
  default = "https://s3.fr-par.scw.cloud"
}

variable "backup_s3_region" {
  type    = string
  default = "fr-par"
}

variable "backup_image_tag" {
  type    = string
  default = "0.1.0"
}
