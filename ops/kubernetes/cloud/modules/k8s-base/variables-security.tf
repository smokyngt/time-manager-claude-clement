variable "falco_minimum_priority" {
  description = "Lowest Falco priority forwarded to Alertmanager by Falcosidekick."
  type        = string
  default     = "warning"

  validation {
    condition     = contains(["emergency", "alert", "critical", "error", "warning", "notice", "informational", "debug"], var.falco_minimum_priority)
    error_message = "falco_minimum_priority must be one of emergency, alert, critical, error, warning, notice, informational, debug."
  }
}

variable "falco_custom_rules" {
  description = "Extra Falco rule files rendered into the chart customRules (file name to YAML content), for example exceptions for a known noisy process."
  type        = map(string)
  default     = {}
}

variable "falco_resources" {
  type = object({
    requests = map(string)
    limits   = map(string)
  })
  default = {
    requests = { cpu = "100m", memory = "256Mi" }
    limits   = { memory = "512Mi" }
  }
}

variable "falco_least_privileged" {
  description = "Run the modern eBPF probe with capabilities (BPF, PERFMON, SYS_RESOURCE, SYS_PTRACE) instead of a privileged container."
  type        = bool
  default     = true
}

variable "falco_node_selector" {
  description = "nodeSelector of the Falco DaemonSet; empty runs it on every node."
  type        = map(string)
  default     = {}
}

variable "kyverno_replicas" {
  description = "Replicas of the Kyverno admission controller (3 keeps webhooks available during node drains) and of the other controllers."
  type = object({
    admission  = optional(number, 3)
    background = optional(number, 1)
    cleanup    = optional(number, 1)
    reports    = optional(number, 1)
  })
  default = {}
}

variable "kyverno_enforce_namespaces" {
  description = "Namespaces where the policies block violating Pods (Enforce); everywhere else they only report (Audit)."
  type        = list(string)
  default     = ["app"]
}

variable "kyverno_excluded_namespaces" {
  description = "Namespaces never evaluated by the policies."
  type        = list(string)
  default     = ["kube-system", "kube-public", "kube-node-lease", "kyverno"]
}

variable "kyverno_allowed_registries" {
  description = "Approved third-party image patterns in addition to var.image_registry. Each entry is a Kyverno pattern such as quay.io/prometheus/* ."
  type        = list(string)
  default = [
    "cr.l5d.io/linkerd/*",
    "ghcr.io/linkerd/*",
    "docker.io/grafana/*",
    "docker.io/falcosecurity/*",
    "docker.io/hashicorp/*",
    "docker.io/library/*",
    "docker.io/traefik:*",
    "docker.io/curlimages/*",
    "hashicorp/*",
    "reg.kyverno.io/*",
    "ghcr.io/jkroepke/*",
    "ghcr.io/cloudnative-pg/*",
    "ghcr.io/external-secrets/*",
    "ghcr.io/kyverno/*",
    "ghcr.io/prometheus-operator/*",
    "ghcr.io/velero/*",
    "quay.io/jetstack/*",
    "quay.io/prometheus/*",
    "quay.io/prometheus-operator/*",
    "quay.io/kiwigrid/*",
    "quay.io/brancz/*",
    "quay.io/kyverno/*",
    "registry.k8s.io/*",
    "velero/*",
  ]
}

variable "kyverno_failure_policy" {
  description = "Behaviour of the admission webhooks when Kyverno is unreachable: Ignore keeps the cluster operating (Pod Security Admission remains the hard guard), Fail blocks admission."
  type        = string
  default     = "Ignore"

  validation {
    condition     = contains(["Ignore", "Fail"], var.kyverno_failure_policy)
    error_message = "kyverno_failure_policy must be Ignore or Fail."
  }
}

variable "kyverno_resources" {
  type = object({
    requests = map(string)
    limits   = map(string)
  })
  default = {
    requests = { cpu = "100m", memory = "256Mi" }
    limits   = { memory = "512Mi" }
  }
}
