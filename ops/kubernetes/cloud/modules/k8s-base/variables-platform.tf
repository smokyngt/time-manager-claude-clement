variable "public_certificates" {
  description = "Issuer family for public hostnames: letsencrypt (DNS-01 Cloudflare) or bootstrap-ca (self-signed, local clusters)."
  type        = string
  default     = "letsencrypt"

  validation {
    condition     = contains(["letsencrypt", "bootstrap-ca"], var.public_certificates)
    error_message = "public_certificates must be letsencrypt or bootstrap-ca."
  }
}

variable "acme_email" {
  description = "Contact email registered with Let's Encrypt."
  type        = string
  default     = "ops@example.com"

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.acme_email))
    error_message = "acme_email must be an email address."
  }
}

variable "traefik_replicas" {
  type    = number
  default = 2

  validation {
    condition     = var.traefik_replicas >= 1
    error_message = "traefik_replicas must be at least 1."
  }
}

variable "traefik_service_type" {
  type    = string
  default = "LoadBalancer"

  validation {
    condition     = contains(["LoadBalancer", "NodePort", "ClusterIP"], var.traefik_service_type)
    error_message = "traefik_service_type must be LoadBalancer, NodePort or ClusterIP."
  }
}

variable "traefik_service_annotations" {
  type    = map(string)
  default = {}
}

variable "traefik_node_ports" {
  description = "Fixed node ports for web and websecure when traefik_service_type is NodePort (kind)."
  type = object({
    web       = optional(number)
    websecure = optional(number)
  })
  default = {}
}

variable "traefik_external_traffic_policy" {
  type    = string
  default = "Local"
}

variable "traefik_node_selector" {
  description = "nodeSelector for Traefik; empty schedules on any node."
  type        = map(string)
  default     = {}
}

variable "traefik_trusted_ips" {
  description = "Proxy CIDRs allowed to set X-Forwarded-* (load balancer, Cloudflare)."
  type        = list(string)
  default     = []
}

variable "admin_allowed_cidrs" {
  description = "Source ranges allowed through the admin-chain (Grafana, Vault UI)."
  type        = list(string)
  default     = ["127.0.0.1/32"]

  validation {
    condition     = alltrue([for c in var.admin_allowed_cidrs : can(cidrnetmask(c)) || can(regex(":", c))])
    error_message = "admin_allowed_cidrs must hold valid CIDR ranges."
  }
}

variable "cloudflare_origin_pull_ca_pem" {
  description = "PEM of the Cloudflare Authenticated Origin Pulls CA; required when features.cloudflare_origin_pull is true."
  type        = string
  default     = ""
}

variable "rate_limit" {
  type = object({
    average = optional(number, 100)
    burst   = optional(number, 200)
    login   = optional(number, 10)
  })
  default = {}
}

variable "kube_api_cidrs" {
  description = "CIDRs of the Kubernetes API server reachable from pods, used by operator network policies."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "kube_api_ports" {
  type    = list(number)
  default = [443, 6443]
}

variable "linkerd_skip_inbound_ports" {
  description = "Ports excluded from the Linkerd proxy on meshed namespaces (PostgreSQL wire, scrape ports)."
  type        = string
  default     = "5432"
}

variable "vault_replicas" {
  type    = number
  default = 3

  validation {
    condition     = contains([1, 3, 5], var.vault_replicas)
    error_message = "vault_replicas must be 1, 3 or 5 so Raft keeps a quorum."
  }
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
  type    = bool
  default = true
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

  validation {
    condition     = contains(["", "awskms", "gcpckms", "azurekeyvault", "transit", "ocikms"], var.vault_kms_type)
    error_message = "vault_kms_type must be empty or a supported seal type."
  }
}

variable "vault_kms_config" {
  type    = map(string)
  default = {}
}

variable "vault_extra_secret_env" {
  type = list(object({
    envName    = string
    secretName = string
    secretKey  = string
  }))
  default = []
}

variable "vault_service_account_annotations" {
  type    = map(string)
  default = {}
}

variable "pki_root_common_name" {
  type    = string
  default = "Time Manager Root CA"
}

variable "pki_intermediate_common_name" {
  type    = string
  default = "Time Manager Internal CA"
}

variable "seed_admin_email" {
  type    = string
  default = "admin@example.com"
}

variable "app_settings" {
  description = "Extra non-secret keys merged into the Vault document secret/app/time-manager."
  type        = map(string)
  default     = {}
}

variable "eso_replicas" {
  type    = number
  default = 2
}

variable "cert_manager_replicas" {
  type    = number
  default = 2
}
