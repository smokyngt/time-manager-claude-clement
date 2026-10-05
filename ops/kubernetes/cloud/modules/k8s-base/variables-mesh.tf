variable "ingress_source_cidrs" {
  description = "Source networks of Traefik traffic as seen by the Linkerd proxy when Traefik is not meshed (pod CIDR of the ingress nodes)."
  type        = list(string)
  default     = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
}

variable "kubelet_probe_cidrs" {
  description = "Networks the kubelet probes come from (node addresses) for the Linkerd NetworkAuthentication."
  type        = list(string)
  default     = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
}

variable "prometheus_service_account" {
  description = "ServiceAccount of Prometheus in the monitoring namespace; its mesh identity is the only client allowed on the metrics ports."
  type        = string
  default     = "kube-prometheus-stack-prometheus"
}


variable "linkerd_controller_replicas" {
  description = "Replicas of the Linkerd control plane components (identity, destination, proxy-injector); 3 enables the HA profile."
  type        = number
  default     = 3

  validation {
    condition     = var.linkerd_controller_replicas >= 1 && var.linkerd_controller_replicas <= 5
    error_message = "linkerd_controller_replicas must be between 1 and 5."
  }
}

variable "linkerd_trust_anchor_ttl" {
  description = "Lifetime of the trust anchor signed by the Vault PKI root. Rotation is manual: terraform apply -replace on the trust anchor resources, then restart meshed workloads."
  type        = string
  default     = "43800h"

  validation {
    condition     = can(regex("^[0-9]+h$", var.linkerd_trust_anchor_ttl)) && tonumber(trimsuffix(var.linkerd_trust_anchor_ttl, "h")) <= 87600
    error_message = "linkerd_trust_anchor_ttl must be an hour count (for example 43800h) that stays within the Vault PKI root lifetime of 87600h."
  }
}

variable "linkerd_identity_issuer" {
  description = "Lifetime of the identity issuer certificate that cert-manager rotates."
  type = object({
    duration     = optional(string, "48h")
    renew_before = optional(string, "25h")
  })
  default = {}
}

variable "linkerd_cni_values" {
  description = "Extra Helm values of the linkerd2-cni chart, for example chained-mode settings for a Cilium cluster."
  type        = any
  default     = {}
}

variable "linkerd_control_plane_values" {
  description = "Extra Helm values merged over the control plane values."
  type        = any
  default     = {}
}

variable "linkerd_proxy_resources" {
  description = "Requests and limits of the injected linkerd proxy."
  type = object({
    cpu_request    = optional(string, "50m")
    memory_request = optional(string, "64Mi")
    memory_limit   = optional(string, "256Mi")
  })
  default = {}
}
