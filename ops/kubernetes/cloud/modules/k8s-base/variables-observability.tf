variable "monitoring_retention" {
  description = "Prometheus retention by time and by size (the size cap must stay below the volume size)."
  type = object({
    prometheus_time = optional(string, "15d")
    prometheus_size = optional(string, "16GB")
  })
  default = {}

  validation {
    condition     = can(regex("^[0-9]+(ms|s|m|h|d|w|y)$", var.monitoring_retention.prometheus_time)) && can(regex("^[0-9]+(B|KB|MB|GB|TB)$", var.monitoring_retention.prometheus_size))
    error_message = "monitoring_retention.prometheus_time must look like 15d and prometheus_size like 16GB."
  }
}

variable "monitoring_storage" {
  description = "Persistent volume sizes of the observability components."
  type = object({
    prometheus   = optional(string, "20Gi")
    alertmanager = optional(string, "2Gi")
    loki         = optional(string, "20Gi")
    tempo        = optional(string, "20Gi")
    grafana      = optional(string, "5Gi")
  })
  default = {}
}

variable "monitoring_resources" {
  description = "Requests and limits per observability component; memory limits stay at or above memory requests."
  type = object({
    prometheus          = optional(object({ requests = map(string), limits = map(string) }), { requests = { cpu = "300m", memory = "1Gi" }, limits = { memory = "2Gi" } })
    prometheus_operator = optional(object({ requests = map(string), limits = map(string) }), { requests = { cpu = "50m", memory = "128Mi" }, limits = { memory = "256Mi" } })
    alertmanager        = optional(object({ requests = map(string), limits = map(string) }), { requests = { cpu = "25m", memory = "64Mi" }, limits = { memory = "128Mi" } })
    grafana             = optional(object({ requests = map(string), limits = map(string) }), { requests = { cpu = "100m", memory = "256Mi" }, limits = { memory = "512Mi" } })
    kube_state_metrics  = optional(object({ requests = map(string), limits = map(string) }), { requests = { cpu = "25m", memory = "64Mi" }, limits = { memory = "256Mi" } })
    node_exporter       = optional(object({ requests = map(string), limits = map(string) }), { requests = { cpu = "25m", memory = "32Mi" }, limits = { memory = "64Mi" } })
    loki                = optional(object({ requests = map(string), limits = map(string) }), { requests = { cpu = "200m", memory = "512Mi" }, limits = { memory = "1Gi" } })
    tempo               = optional(object({ requests = map(string), limits = map(string) }), { requests = { cpu = "100m", memory = "256Mi" }, limits = { memory = "1Gi" } })
    alloy_gateway       = optional(object({ requests = map(string), limits = map(string) }), { requests = { cpu = "100m", memory = "256Mi" }, limits = { memory = "512Mi" } })
    alloy_logs          = optional(object({ requests = map(string), limits = map(string) }), { requests = { cpu = "50m", memory = "128Mi" }, limits = { memory = "256Mi" } })
  })
  default = {}
}

variable "monitoring_alert_webhook_enabled" {
  description = "Route Alertmanager and Grafana alerts to the webhook of the ExternalSecret alertmanager-webhook (Vault secret/monitoring/alertmanager, key webhook_url); when false alerts stay in the Alertmanager UI."
  type        = bool
  default     = false
}


variable "monitoring_external_egress_cidrs" {
  description = "Destinations (HTTPS 443) reachable from the monitoring namespace: object storage for Loki and the alert webhook. Private ranges are always excluded."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "monitoring_probe_targets" {
  description = "Black-box probes run by Alloy (job probes, label target). Defaults match the api and web Services."
  type        = map(string)
  default = {
    "api-readiness" = "https://api.app.svc.cluster.local:8000/health/ready"
    "api-liveness"  = "https://api.app.svc.cluster.local:8000/health"
    "web"           = "http://web.app.svc.cluster.local:8080/healthz"
  }
}

variable "monitoring_log_namespaces" {
  description = "Namespaces whose pod logs are shipped to Loki; null selects every platform namespace."
  type        = list(string)
  default     = null
}

variable "monitoring_excluded_rule_groups" {
  description = "Groups of ops/observability/prometheus/rules/alerts.yml that are not loaded because their metrics do not exist on Kubernetes (postgres-exporter and the compose backup sidecar); alerts-kubernetes.yml replaces them with CloudNativePG and Velero rules."
  type        = list(string)
  default     = ["tm-postgres", "tm-backup"]
}

variable "monitoring_platform_namespaces" {
  description = "Namespaces of the platform components scraped by PodMonitors."
  type = object({
    traefik          = optional(string, "traefik")
    cert_manager     = optional(string, "cert-manager")
    external_secrets = optional(string, "external-secrets")
    velero           = optional(string, "velero")
    cnpg_operator    = optional(string, "databases")
  })
  default = {}
}

variable "grafana_oidc_role_attribute_path" {
  description = "JMESPath evaluated on the Vault userinfo claims to pick the Grafana role."
  type        = string
  default     = "'Viewer'"
}

variable "otlp_tls_enabled" {
  description = "Serve the Alloy OTLP receivers (4317 gRPC, 4318 HTTP) over TLS with a certificate from the Vault PKI ClusterIssuer; clients use the https endpoint and the internal CA bundle."
  type        = bool
  default     = true
}

variable "otlp_certificate" {
  description = "Lifetime of the Alloy OTLP certificate; the Vault role internal-services caps it at 72h."
  type = object({
    duration     = optional(string, "48h")
    renew_before = optional(string, "16h")
  })
  default = {}
}

variable "loki_object_storage" {
  description = "S3-compatible object storage for Loki chunks. Disabled keeps the filesystem on the PVC (kind). Credentials come from Vault secret/monitoring/loki-s3 (access_key_id, secret_access_key)."
  type = object({
    enabled          = optional(bool, false)
    endpoint         = optional(string, "")
    region           = optional(string, "")
    bucket           = optional(string, "")
    force_path_style = optional(bool, true)
    insecure         = optional(bool, false)
  })
  default = {}

  validation {
    condition     = !var.loki_object_storage.enabled || (var.loki_object_storage.endpoint != "" && var.loki_object_storage.region != "" && var.loki_object_storage.bucket != "")
    error_message = "loki_object_storage.enabled needs endpoint, region and bucket."
  }
}
