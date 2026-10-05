variable "tenant" {
  description = "Tenant DNS label used in every public hostname (<service>.<tenant>.<base_domain>)."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$", var.tenant))
    error_message = "tenant must be a single DNS label: lowercase letters, digits and hyphens, 1 to 63 characters, no leading or trailing hyphen."
  }
}

variable "base_domain" {
  description = "Registered DNS zone that hosts the tenant, for example example.com."
  type        = string

  validation {
    condition     = can(regex("^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,}$", var.base_domain))
    error_message = "base_domain must be a lowercase fully qualified domain such as example.com."
  }
}

variable "cluster_name" {
  description = "Cluster name, written in the cluster label of every namespace."
  type        = string
  default     = "time-manager"

  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$", var.cluster_name))
    error_message = "cluster_name must be a DNS-1123 label."
  }
}

variable "image_registry" {
  description = "Registry path of the first-party images, without a trailing slash (for example rg.fr-par.scw.cloud/time-manager)."
  type        = string

  validation {
    condition     = !endswith(var.image_registry, "/") && length(var.image_registry) > 0
    error_message = "image_registry must be non-empty and must not end with a slash."
  }
}

variable "image_pull_secret" {
  description = "Name of the kubernetes.io/dockerconfigjson Secret created in every namespace that runs first-party images."
  type        = string
  default     = "registry-pull"
}

variable "registry_credentials" {
  description = "Credentials of the private registry; null skips the pull secret (public registry)."
  type = object({
    server   = string
    username = string
    password = string
  })
  default   = null
  sensitive = true
}

variable "chart_versions" {
  description = "Overrides merged over the pinned defaults of local.chart_versions."
  type        = map(string)
  default     = {}

  validation {
    condition = alltrue([
      for k in keys(var.chart_versions) : contains([
        "traefik", "cert-manager", "vault", "external-secrets", "cloudnative-pg", "velero", "longhorn",
        "kube-prometheus-stack", "loki", "tempo", "alloy", "prometheus-adapter", "vpa", "falco", "kyverno",
        "linkerd-crds", "linkerd-control-plane", "linkerd-cni",
      ], k)
    ])
    error_message = "chart_versions holds an unknown key. Allowed: traefik, cert-manager, vault, external-secrets, cloudnative-pg, velero, longhorn, kube-prometheus-stack, loki, tempo, alloy, prometheus-adapter, vpa, falco, kyverno, linkerd-crds, linkerd-control-plane, linkerd-cni."
  }
}

variable "features" {
  description = "Feature switches shared by every concern."
  type = object({
    restore_jobs         = optional(bool, false)
    longhorn_backup      = optional(bool, false)
    runtime_security     = optional(bool, true)
    kyverno              = optional(bool, false)
    microsoft_egress     = optional(bool, false)
    grafana_oidc         = optional(bool, false)
    letsencrypt_staging  = optional(bool, false)
    vault_ui_exposed     = optional(bool, false)
    cloudflare_origin_pull = optional(bool, false)
  })
  default = {}
}

variable "storage_class_default" {
  description = "StorageClass for general persistent volumes (reclaimPolicy Delete)."
  type        = string
}

variable "storage_class_retain" {
  description = "StorageClass whose volumes survive claim deletion; used by Vault and PostgreSQL."
  type        = string
}

variable "data_node_selector" {
  description = "nodeSelector that pins stateful workloads to the data pool."
  type        = map(string)
  default     = { "timemanager.io/role" = "data" }
}

variable "data_tolerations" {
  description = "Tolerations for stateful workloads on the data pool."
  type = list(object({
    key      = string
    operator = optional(string, "Equal")
    value    = optional(string)
    effect   = optional(string)
  }))
  default = [{
    key      = "timemanager.io/role"
    operator = "Equal"
    value    = "data"
    effect   = "NoSchedule"
  }]
}
