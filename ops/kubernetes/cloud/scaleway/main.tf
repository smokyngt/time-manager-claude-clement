locals {
  data_taint = { key = "timemanager.io/role", value = "data", effect = "NoSchedule" }
  tags       = ["time-manager", var.tenant, "terraform"]
}

resource "scaleway_vpc_private_network" "this" {
  name       = "${var.cluster_name}-${var.tenant}"
  region     = var.region
  project_id = var.project_id
  tags       = local.tags
}

resource "scaleway_k8s_cluster" "this" {
  name                        = "${var.cluster_name}-${var.tenant}"
  type                        = "kapsule"
  version                     = var.kubernetes_version
  cni                         = "cilium"
  private_network_id          = scaleway_vpc_private_network.this.id
  delete_additional_resources = var.delete_additional_resources
  project_id                  = var.project_id
  tags                        = local.tags

  auto_upgrade {
    enable                        = var.auto_upgrade.enable
    maintenance_window_day        = var.auto_upgrade.day
    maintenance_window_start_hour = var.auto_upgrade.start_hour
  }

  autoscaler_config {
    disable_scale_down               = false
    scale_down_delay_after_add       = "10m"
    scale_down_unneeded_time         = "1h"
    scale_down_utilization_threshold = 0.5
    estimator                        = "binpacking"
    expander                         = "least_waste"
    ignore_daemonsets_utilization    = true
    balance_similar_node_groups      = true
    expendable_pods_priority_cutoff  = -10
    max_graceful_termination_sec     = 600
  }

  lifecycle {
    precondition {
      condition     = !(var.auto_upgrade.enable && var.vault_kms_type == "")
      error_message = "Kapsule auto-upgrade is enabled while Vault uses the Shamir seal. What breaks: every upgrade replaces the nodes one by one, each Vault pod restarts sealed, and the API, cert-manager and External Secrets lose Vault until a human unseals it. Why: Shamir keys are held offline and no automation can supply them. Fixes: (1) set auto_upgrade.enable = false and upgrade manually in the maintenance window with an operator ready to unseal; (2) configure vault_kms_type and vault_kms_config for auto-unseal; (3) accept the outage and keep the unseal runbook on call."
    }

    precondition {
      condition     = !var.delete_additional_resources
      error_message = "delete_additional_resources is true. What breaks: destroying the cluster also deletes every Block Storage volume, including the Retain volumes of Vault and PostgreSQL. Why: the flag asks Scaleway to remove all resources created for the cluster. Fixes: (1) set it to false and delete volumes deliberately after a verified restore drill; (2) take and test Velero and CNPG backups before flipping it; (3) split the data into a separate project that this stack never destroys."
    }

    precondition {
      condition     = length(var.kube_api_allowed_ips) > 0
      error_message = "kube_api_allowed_ips is empty. What breaks: the API-server ACL would admit only Scaleway ranges and this Terraform run, the Helm provider and every operator laptop lose access. Why: Kapsule enforces the ACL on the public endpoint. Fixes: (1) list your own egress IP as a /32; (2) add the CI runner range; (3) use a private network bastion and list its address."
    }
  }
}

resource "scaleway_k8s_acl" "this" {
  cluster_id = scaleway_k8s_cluster.this.id

  acl_rules {
    scaleway_ranges = true
    description     = "Scaleway managed ranges"
  }

  dynamic "acl_rules" {
    for_each = toset(var.kube_api_allowed_ips)
    content {
      ip          = acl_rules.value
      description = "allowed operator range"
    }
  }
}

resource "scaleway_k8s_pool" "app" {
  cluster_id  = scaleway_k8s_cluster.this.id
  name        = "app"
  node_type   = var.app_pool.node_type
  zone        = var.zone
  size        = var.app_pool.size
  min_size    = var.app_pool.min_size
  max_size    = var.app_pool.max_size
  autoscaling = true
  autohealing = true
  tags        = concat(local.tags, ["role-app"])

  upgrade_policy {
    max_surge       = 1
    max_unavailable = 1
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "scaleway_k8s_pool" "data" {
  cluster_id  = scaleway_k8s_cluster.this.id
  name        = "data"
  node_type   = var.data_pool.node_type
  zone        = var.zone
  size        = var.data_pool.size
  autoscaling = false
  autohealing = true
  tags        = concat(local.tags, ["role-data"])

  labels = {
    (local.data_taint.key) = local.data_taint.value
  }

  taints {
    key    = local.data_taint.key
    value  = local.data_taint.value
    effect = local.data_taint.effect
  }

  upgrade_policy {
    max_surge       = 1
    max_unavailable = 0
  }

  lifecycle {
    create_before_destroy = true

    precondition {
      condition     = var.data_pool.size >= var.vault_replicas
      error_message = "The data pool has fewer nodes than Vault replicas. What breaks: Vault pods carry a hard anti-affinity on the hostname and stay Pending, so Raft never reaches quorum. Why: the data pool is the only pool that tolerates the data taint. Fixes: (1) raise data_pool.size to at least vault_replicas; (2) lower vault_replicas to 1 for a non-production cluster; (3) remove the data taint and node selector and accept shared nodes."
    }

    precondition {
      condition     = var.data_pool.size >= 3
      error_message = "The data pool has fewer than three nodes. What breaks: PostgreSQL runs three instances spread over hostnames, so with fewer nodes replicas stay Pending and the cluster has no failover. Why: instance anti-affinity is required for the high-availability promise. Fixes: (1) set data_pool.size to 3 or more; (2) reduce the CloudNativePG instances to 1 knowingly; (3) allow co-location through a preferred anti-affinity."
    }
  }
}
