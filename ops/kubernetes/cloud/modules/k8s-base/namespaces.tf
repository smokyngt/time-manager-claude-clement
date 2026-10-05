locals {
  namespace_config = {
    (local.ns.vault) = {
      psa    = "baseline"
      mesh   = false
      reason = "Vault raft pods run restricted-compatible but the auditStorage and IPC_LOCK options need the baseline profile"
    }
    (local.ns.databases) = {
      psa    = "restricted"
      mesh   = true
      reason = "CloudNativePG instance pods are restricted-compatible"
    }
    (local.ns.monitoring) = {
      psa    = "privileged"
      mesh   = true
      reason = "node-exporter mounts host paths and the host network; the namespace hosts the node agents"
    }
    (local.ns.backup) = {
      psa    = "restricted"
      mesh   = true
      reason = "backup jobs run unprivileged"
    }
    (local.ns.app) = {
      psa    = "restricted"
      mesh   = true
      reason = "api and web are hardened workloads"
    }
    (local.ns.cert_manager) = {
      psa    = "restricted"
      mesh   = false
      reason = "cert-manager is restricted-compatible"
    }
    (local.ns.external_secrets) = {
      psa    = "restricted"
      mesh   = false
      reason = "External Secrets Operator is restricted-compatible"
    }
    (local.ns.linkerd) = {
      psa    = "restricted"
      mesh   = false
      reason = "control plane runs with CNI mode and needs no extra capability"
    }
    (local.ns.linkerd_cni) = {
      psa    = "privileged"
      mesh   = false
      reason = "linkerd-cni writes CNI configuration on the host and needs hostPath plus NET_ADMIN"
    }
    (local.ns.traefik) = {
      psa    = "restricted"
      mesh   = false
      reason = "Traefik binds unprivileged ports 8000 and 8443"
    }
    (local.ns.falco) = {
      psa    = "privileged"
      mesh   = false
      reason = "Falco loads the eBPF probe and reads the host proc and kernel interfaces"
    }
    (local.ns.kyverno) = {
      psa    = "restricted"
      mesh   = false
      reason = "Kyverno controllers are restricted-compatible"
    }
    (local.ns.velero) = {
      psa    = "privileged"
      mesh   = false
      reason = "the Velero node agent mounts /var/lib/kubelet/pods through hostPath"
    }
    (local.ns.longhorn) = {
      psa    = "privileged"
      mesh   = false
      reason = "Longhorn manager and instance managers mount host devices and run privileged"
    }
  }
}

resource "kubernetes_namespace_v1" "this" {
  for_each = local.namespace_config

  metadata {
    name = each.key

    labels = {
      "app.kubernetes.io/managed-by"               = "terraform"
      "app.kubernetes.io/part-of"                  = "time-manager"
      "kubernetes.io/metadata.name"                = each.key
      "cluster"                                    = var.cluster_name
      "pod-security.kubernetes.io/enforce"         = each.value.psa
      "pod-security.kubernetes.io/enforce-version" = "latest"
      "pod-security.kubernetes.io/audit"           = each.value.psa
      "pod-security.kubernetes.io/audit-version"   = "latest"
      "pod-security.kubernetes.io/warn"            = each.value.psa
      "pod-security.kubernetes.io/warn-version"    = "latest"
    }

    annotations = merge(
      { "timemanager.io/psa-reason" = each.value.reason },
      each.value.mesh ? {
        "linkerd.io/inject"                        = "enabled"
        "config.linkerd.io/default-inbound-policy" = "cluster-authenticated"
        "config.linkerd.io/skip-inbound-ports"     = var.linkerd_skip_inbound_ports
      } : {},
    )
  }

  lifecycle {
    ignore_changes = [metadata[0].annotations["linkerd.io/created-by"]]
  }
}

resource "kubernetes_priority_class_v1" "critical" {
  metadata {
    name   = "critical"
    labels = local.common_labels
  }

  value          = 1000000
  global_default = false
  description    = "Platform components whose loss stops the service: Vault, ingress, databases, cert-manager."
}

resource "kubernetes_priority_class_v1" "default_priority" {
  metadata {
    name   = "default-priority"
    labels = local.common_labels
  }

  value          = 1000
  global_default = true
  description    = "Default priority of application workloads."
}

resource "kubernetes_priority_class_v1" "low" {
  metadata {
    name   = "low"
    labels = local.common_labels
  }

  value             = 100
  global_default    = false
  preemption_policy = "Never"
  description       = "Batch and best-effort jobs that must never preempt services."
}

resource "kubernetes_secret_v1" "image_pull" {
  for_each = nonsensitive(var.registry_credentials != null) ? local.pull_secret_namespaces : toset([])

  metadata {
    name      = var.image_pull_secret
    namespace = kubernetes_namespace_v1.this[each.key].metadata[0].name
    labels    = local.common_labels
  }

  type = "kubernetes.io/dockerconfigjson"

  data = {
    ".dockerconfigjson" = jsonencode({
      auths = {
        (var.registry_credentials.server) = {
          username = var.registry_credentials.username
          password = var.registry_credentials.password
          auth     = base64encode("${var.registry_credentials.username}:${var.registry_credentials.password}")
        }
      }
    })
  }
}
