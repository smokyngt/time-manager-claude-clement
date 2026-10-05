locals {
  data_label = "timemanager.io/role=data"
  data_taint = "timemanager.io/role=data:NoSchedule"

  kubeadm_join = {
    app  = <<-YAML
      kind: JoinConfiguration
      nodeRegistration:
        kubeletExtraArgs:
          node-labels: "timemanager.io/role=app"
    YAML
    data = <<-YAML
      kind: JoinConfiguration
      nodeRegistration:
        kubeletExtraArgs:
          node-labels: "${local.data_label}"
          register-with-taints: "${local.data_taint}"
    YAML
  }
}

resource "kind_cluster" "this" {
  name           = var.cluster_name
  node_image     = var.node_image
  wait_for_ready = true

  kind_config {
    kind        = "Cluster"
    api_version = "kind.x-k8s.io/v1alpha4"

    networking {
      disable_default_cni = false
    }

    node {
      role = "control-plane"

      kubeadm_config_patches = [
        <<-YAML
          kind: InitConfiguration
          nodeRegistration:
            kubeletExtraArgs:
              node-labels: "ingress-ready=true"
        YAML
      ]

      extra_port_mappings {
        container_port = 30080
        host_port      = var.http_host_port
        protocol       = "TCP"
      }

      extra_port_mappings {
        container_port = 30443
        host_port      = var.https_host_port
        protocol       = "TCP"
      }
    }

    dynamic "node" {
      for_each = range(var.app_workers)
      content {
        role                   = "worker"
        kubeadm_config_patches = [local.kubeadm_join.app]
      }
    }

    dynamic "node" {
      for_each = range(var.data_workers)
      content {
        role                   = "worker"
        kubeadm_config_patches = [local.kubeadm_join.data]
      }
    }
  }
}

resource "kubernetes_storage_class_v1" "local" {
  metadata {
    name   = "timemanager-local"
    labels = { "app.kubernetes.io/managed-by" = "terraform" }
  }

  storage_provisioner    = "rancher.io/local-path"
  reclaim_policy         = "Delete"
  volume_binding_mode    = "WaitForFirstConsumer"
  allow_volume_expansion = false

  depends_on = [kind_cluster.this]
}

resource "kubernetes_storage_class_v1" "local_retain" {
  metadata {
    name   = "timemanager-local-retain"
    labels = { "app.kubernetes.io/managed-by" = "terraform" }
  }

  storage_provisioner    = "rancher.io/local-path"
  reclaim_policy         = "Retain"
  volume_binding_mode    = "WaitForFirstConsumer"
  allow_volume_expansion = false

  depends_on = [kind_cluster.this]
}

module "k8s_base" {
  source = "../modules/k8s-base"

  providers = {
    kubernetes = kubernetes
    helm       = helm
    kubectl    = kubectl
    vault      = vault
  }

  tenant                = var.tenant
  base_domain           = var.base_domain
  cluster_name          = var.cluster_name
  image_registry        = var.image_registry
  chart_versions        = var.chart_versions
  features              = var.features
  storage_class_default = kubernetes_storage_class_v1.local.metadata[0].name
  storage_class_retain  = kubernetes_storage_class_v1.local_retain.metadata[0].name

  public_certificates  = "bootstrap-ca"
  acme_email           = var.acme_email
  seed_admin_email     = var.seed_admin_email
  admin_allowed_cidrs  = ["0.0.0.0/0"]
  traefik_replicas     = 1
  traefik_service_type = "NodePort"
  traefik_node_ports = {
    web       = 30080
    websecure = 30443
  }
  postgres_instances = 1
  vault_replicas     = var.data_workers >= 3 ? 3 : 1

  vault_backup_passphrase = var.vault_backup_passphrase
  backup_s3_bucket        = var.backup_s3_bucket
  backup_s3_endpoint      = var.backup_s3_endpoint
  backup_s3_region        = var.backup_s3_region
  backup_image_tag        = var.backup_image_tag
  depends_on              = [kind_cluster.this]
}
