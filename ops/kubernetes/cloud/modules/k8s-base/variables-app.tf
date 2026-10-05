variable "api_image_tag" {
  description = "Pinned tag of the api image (release workflow semver tag or short sha); the migration Job name derives from it."
  type        = string
  default     = "0.1.0"

  validation {
    condition     = can(regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$", var.api_image_tag)) && !contains(["latest", "main", "master"], lower(var.api_image_tag))
    error_message = "api_image_tag must be 1 to 40 characters from [A-Za-z0-9._-] and cannot be a floating tag (latest, main, master): the migration Job name derives from it and rollbacks need an exact tag."
  }
}

variable "web_image_tag" {
  description = "Pinned tag of the web image."
  type        = string
  default     = "0.1.0"

  validation {
    condition     = can(regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$", var.web_image_tag)) && !contains(["latest", "main", "master"], lower(var.web_image_tag))
    error_message = "web_image_tag must be a valid image tag and cannot be a floating tag (latest, main, master)."
  }
}

variable "api_image_name" {
  description = "Repository name of the api image below var.image_registry."
  type        = string
  default     = "api"
}

variable "web_image_name" {
  description = "Repository name of the web image below var.image_registry."
  type        = string
  default     = "web"
}

variable "wait_vault_image" {
  description = "Minimal pinned curl image of the wait-vault init container (runs as 65534); mirror it into the private registry when a registry allowlist is enforced."
  type        = string
  default     = "docker.io/curlimages/curl:8.12.1"

  validation {
    condition     = can(regex(":[A-Za-z0-9._-]+$", var.wait_vault_image)) && !endswith(var.wait_vault_image, ":latest")
    error_message = "wait_vault_image must carry an explicit non-latest tag."
  }
}

variable "api_tls_enabled" {
  description = "The api serves HTTPS with a Vault PKI certificate (VAULT_PKI_ENABLED=true): probes, Service scrape, Traefik backend and mesh Server switch to TLS."
  type        = bool
  default     = true
}

variable "expose_api_publicly" {
  description = "Publish the api at api.<app_domain> through Traefik in addition to the web proxy; false removes the IngressRoute, the certificate and allow-traefik-to-api."
  type        = bool
  default     = true
}

variable "api_replicas" {
  description = "Initial api replicas; the HPA owns the value afterwards (spec.replicas is ignored)."
  type        = number
  default     = 2

  validation {
    condition     = var.api_replicas >= 1 && floor(var.api_replicas) == var.api_replicas
    error_message = "api_replicas must be a whole number of at least 1."
  }
}

variable "web_replicas" {
  description = "Initial web replicas; the HPA owns the value afterwards."
  type        = number
  default     = 2

  validation {
    condition     = var.web_replicas >= 1 && floor(var.web_replicas) == var.web_replicas
    error_message = "web_replicas must be a whole number of at least 1."
  }
}

variable "api_resources" {
  description = "Requests and limits of the api container (memory limit at least the request)."
  type = object({
    requests = object({ cpu = string, memory = string })
    limits   = object({ cpu = optional(string), memory = string })
  })
  default = {
    requests = { cpu = "250m", memory = "256Mi" }
    limits   = { memory = "512Mi" }
  }
}

variable "web_resources" {
  description = "Requests and limits of the web container."
  type = object({
    requests = object({ cpu = string, memory = string })
    limits   = object({ cpu = optional(string), memory = string })
  })
  default = {
    requests = { cpu = "50m", memory = "64Mi" }
    limits   = { memory = "128Mi" }
  }
}

variable "migration_resources" {
  description = "Requests and limits of the migration Job container."
  type = object({
    requests = object({ cpu = string, memory = string })
    limits   = object({ cpu = optional(string), memory = string })
  })
  default = {
    requests = { cpu = "100m", memory = "128Mi" }
    limits   = { memory = "256Mi" }
  }
}

variable "api_prestop_sleep_seconds" {
  description = "preStop sleep of the api so endpoints and Traefik drop the pod before SIGTERM (needs Kubernetes 1.30+ for the sleep action)."
  type        = number
  default     = 10

  validation {
    condition     = var.api_prestop_sleep_seconds >= 0 && var.api_prestop_sleep_seconds <= 45
    error_message = "api_prestop_sleep_seconds must stay between 0 and 45 so it fits in terminationGracePeriodSeconds (60) with time left for the drain."
  }
}

variable "web_prestop_sleep_seconds" {
  description = "preStop sleep of the web pods."
  type        = number
  default     = 5

  validation {
    condition     = var.web_prestop_sleep_seconds >= 0 && var.web_prestop_sleep_seconds <= 45
    error_message = "web_prestop_sleep_seconds must stay between 0 and 45."
  }
}

variable "api_priority_class" {
  description = "PriorityClass of the api pods (created by the platform core: critical, default-priority, low)."
  type        = string
  default     = "critical"
}

variable "web_priority_class" {
  description = "PriorityClass of the web pods."
  type        = string
  default     = "default-priority"
}

variable "api_startup_failure_threshold" {
  description = "Startup probe failures (every 5 s) tolerated while the api loads Vault configuration and the PKI certificate."
  type        = number
  default     = 36
}

variable "migration_ttl_seconds" {
  description = "ttlSecondsAfterFinished of the migration Job."
  type        = number
  default     = 86400
}

variable "migration_deadline_seconds" {
  description = "activeDeadlineSeconds of the migration Job."
  type        = number
  default     = 900
}

variable "api_metrics_token_secret" {
  description = "Secret created by External Secrets Operator that holds the bearer token of /metrics (ServiceMonitor reference only)."
  type = object({
    name = optional(string, "api-metrics-token")
    key  = optional(string, "token")
  })
  default = {}
}

variable "api_extra_env" {
  description = "Extra non-secret environment variables added to the api ConfigMap. Secrets belong in Vault."
  type        = map(string)
  default     = {}

  validation {
    condition     = alltrue([for k in keys(var.api_extra_env) : !can(regex("(?i)(SECRET|TOKEN|PASSWORD|KEY)", k))])
    error_message = "api_extra_env keys must not look like secrets (SECRET, TOKEN, PASSWORD, KEY): store them in the Vault document secret/app/time-manager."
  }
}





variable "traefik_pod_labels" {
  description = "Labels of the Traefik pods used by the NetworkPolicies."
  type        = map(string)
  default     = { "app.kubernetes.io/name" = "traefik" }
}

variable "middleware_namespace" {
  description = "Namespace that holds the Traefik Middleware chains default-chain and admin-chain."
  type        = string
  default     = "kube-system"
}



variable "postgres_pod_labels" {
  description = "Labels of the PostgreSQL pods the api connects to (CloudNativePG cluster label)."
  type        = map(string)
  default     = { "cnpg.io/podRole" = "instance" }
}


variable "alloy_pod_labels" {
  description = "Labels of the Alloy pods (OTLP receiver on 4318)."
  type        = map(string)
  default     = { "app.kubernetes.io/name" = "alloy" }
}

variable "alloy_service_name" {
  description = "Service name of Alloy in the monitoring namespace (OTLP HTTP on 4318)."
  type        = string
  default     = "alloy"
}

variable "prometheus_pod_labels" {
  description = "Labels of the Prometheus pods that scrape the workloads."
  type        = map(string)
  default     = { "app.kubernetes.io/name" = "prometheus" }
}

variable "prometheus_release_label" {
  description = "Value of the label release that the Prometheus operator selects ServiceMonitors, PodMonitors and PrometheusRules by."
  type        = string
  default     = "kube-prometheus-stack"
}

variable "microsoft_egress_cidrs" {
  description = "Destination networks of allow-api-egress-microsoft (login.microsoftonline.com has no stable range, so the default is the internet minus private ranges)."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "microsoft_egress_except_cidrs" {
  description = "Private ranges excluded from the Microsoft egress allowance."
  type        = list(string)
  default     = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16"]
}


variable "vault_secrets_path" {
  description = "KV v2 data path of the api configuration document."
  type        = string
  default     = "secret/data/app/time-manager"
}

variable "vault_database_secret_path" {
  description = "KV v2 data path of the PostgreSQL credentials."
  type        = string
  default     = "secret/data/databases/postgres"
}

variable "autoscaling" {
  description = "HPA bounds per scalable component (api, web). The scheduled scaling job rewrites minReplicas outside Terraform; Terraform ignores that field."
  type = map(object({
    min_replicas = number
    max_replicas = number
  }))
  default = {
    api = { min_replicas = 2, max_replicas = 6 }
    web = { min_replicas = 2, max_replicas = 4 }
  }

  validation {
    condition     = alltrue([for k, v in var.autoscaling : v.min_replicas >= 1 && v.max_replicas >= v.min_replicas])
    error_message = "Every autoscaling entry needs 1 <= min_replicas <= max_replicas."
  }

  validation {
    condition     = toset(keys(var.autoscaling)) == toset(["api", "web"])
    error_message = "autoscaling must define exactly the scalable components api and web."
  }
}

variable "api_hpa_requests_per_second" {
  description = "Target of http_requests_per_second per api pod served by the Prometheus adapter; null keeps the HPA on CPU and memory only."
  type        = number
  default     = null
}

variable "scaling_schedule" {
  description = "Scheduled lowering of the HPA minReplicas outside business hours. Cron expressions are evaluated in timezone."
  type = object({
    enabled       = optional(bool, true)
    timezone      = optional(string, "Europe/Paris")
    peak_cron     = optional(string, "0 6 * * *")
    off_peak_cron = optional(string, "0 22 * * *")
  })
  default = {}

  validation {
    condition     = can(regex("^\\S+ \\S+ \\S+ \\S+ \\S+$", var.scaling_schedule.peak_cron)) && can(regex("^\\S+ \\S+ \\S+ \\S+ \\S+$", var.scaling_schedule.off_peak_cron))
    error_message = "scaling_schedule.peak_cron and off_peak_cron must be five-field cron expressions."
  }
}

variable "off_peak_min_replicas" {
  description = "HPA minReplicas during off-peak hours (never below 1)."
  type        = number
  default     = 1

  validation {
    condition     = var.off_peak_min_replicas >= 1 && floor(var.off_peak_min_replicas) == var.off_peak_min_replicas
    error_message = "off_peak_min_replicas must be a whole number of at least 1."
  }
}

variable "kubectl_image" {
  description = "Pinned image with kubectl as entrypoint, used by the scheduled scaling jobs."
  type        = string
  default     = "registry.k8s.io/kubectl:v1.33.4"

  validation {
    condition     = can(regex(":[A-Za-z0-9._-]+$", var.kubectl_image)) && !endswith(var.kubectl_image, ":latest")
    error_message = "kubectl_image must carry an explicit non-latest tag."
  }
}

variable "prometheus_service_name" {
  description = "Service of Prometheus in the monitoring namespace queried by the Prometheus adapter."
  type        = string
  default     = "kube-prometheus-stack-prometheus"
}

variable "vault_pod_labels" {
  description = "Labels of the Vault server pods used by NetworkPolicies and ServiceMonitors."
  type        = map(string)
  default     = { "app.kubernetes.io/name" = "vault", "component" = "server" }
}
