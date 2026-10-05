variable "project_id" {
  description = "Scaleway project that owns every resource."
  type        = string
}

variable "region" {
  type    = string
  default = "fr-par"
}

variable "zone" {
  type    = string
  default = "fr-par-1"
}

variable "tenant" {
  type = string
}

variable "base_domain" {
  type = string
}

variable "cluster_name" {
  type    = string
  default = "time-manager"
}

variable "kubernetes_version" {
  description = "Pinned Kapsule version (major.minor.patch)."
  type        = string
  default     = "1.32.3"

  validation {
    condition     = can(regex("^1\\.[0-9]+\\.[0-9]+$", var.kubernetes_version))
    error_message = "kubernetes_version must look like 1.32.3."
  }
}

variable "auto_upgrade" {
  type = object({
    enable     = optional(bool, false)
    day        = optional(string, "sunday")
    start_hour = optional(number, 3)
  })
  default = {}
}

variable "kube_api_allowed_ips" {
  description = "CIDRs allowed to reach the Kubernetes API server (operators, CI runners); the provider ranges are always added."
  type        = list(string)

  validation {
    condition     = alltrue([for c in var.kube_api_allowed_ips : can(cidrnetmask(c)) || can(regex(":", c))])
    error_message = "kube_api_allowed_ips must hold CIDR ranges such as 203.0.113.7/32."
  }
}

variable "delete_additional_resources" {
  type    = bool
  default = false
}

variable "app_pool" {
  type = object({
    node_type = optional(string, "COPARM1-4C-16G")
    size      = optional(number, 3)
    min_size  = optional(number, 3)
    max_size  = optional(number, 8)
  })
  default = {}

  validation {
    condition     = var.app_pool.min_size <= var.app_pool.size && var.app_pool.size <= var.app_pool.max_size
    error_message = "app_pool needs min_size <= size <= max_size."
  }
}

variable "data_pool" {
  type = object({
    node_type = optional(string, "POP2-4C-16G")
    size      = optional(number, 3)
  })
  default = {}
}

variable "storage_iops" {
  description = "Scaleway Block Storage class of the encrypted volumes (5k or 15k)."
  type        = string
  default     = "5k"

  validation {
    condition     = contains(["5k", "15k"], var.storage_iops)
    error_message = "storage_iops must be 5k or 15k."
  }
}

variable "registry_namespace" {
  type    = string
  default = "time-manager"
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone id of base_domain; empty skips DNS records."
  type        = string
  default     = ""
}

variable "dns_proxied" {
  type    = bool
  default = true
}

variable "vault_address" {
  description = "Vault address for the provider (kubectl -n vault port-forward svc/vault 8200:8200)."
  type        = string
  default     = "https://127.0.0.1:8200"
}

variable "vault_ca_cert_file" {
  type    = string
  default = ""
}

variable "vault_kms_type" {
  type    = string
  default = ""
}

variable "vault_kms_config" {
  type    = map(string)
  default = {}
}

variable "vault_replicas" {
  type    = number
  default = 3
}

variable "acme_email" {
  type = string
}

variable "seed_admin_email" {
  type = string
}

variable "admin_allowed_cidrs" {
  type = list(string)
}

variable "features" {
  type = object({
    restore_jobs           = optional(bool, false)
    longhorn_backup        = optional(bool, false)
    runtime_security       = optional(bool, true)
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

variable "cloudflare_origin_pull_ca_pem" {
  type    = string
  default = ""
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
