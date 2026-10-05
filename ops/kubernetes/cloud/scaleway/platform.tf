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
  cluster_name          = "${var.cluster_name}-${var.tenant}"
  image_registry        = scaleway_registry_namespace.this.endpoint
  chart_versions        = var.chart_versions
  features              = var.features
  storage_class_default = kubernetes_storage_class_v1.encrypted.metadata[0].name
  storage_class_retain  = kubernetes_storage_class_v1.encrypted_retain.metadata[0].name

  registry_credentials = {
    server   = local.registry_server
    username = "nologin"
    password = scaleway_iam_api_key.registry_pull.secret_key
  }

  public_certificates             = "letsencrypt"
  acme_email                      = var.acme_email
  seed_admin_email                = var.seed_admin_email
  admin_allowed_cidrs             = var.admin_allowed_cidrs
  cloudflare_origin_pull_ca_pem   = var.cloudflare_origin_pull_ca_pem
  traefik_service_type            = "LoadBalancer"
  traefik_external_traffic_policy = "Local"
  traefik_service_annotations = {
    "service.beta.kubernetes.io/scw-loadbalancer-zone"              = var.zone
    "service.beta.kubernetes.io/scw-loadbalancer-use-hostname"      = "false"
    "service.beta.kubernetes.io/scw-loadbalancer-proxy-protocol-v2" = "false"
  }
  traefik_node_selector = { "k8s.scaleway.com/pool-name" = scaleway_k8s_pool.app.name }
  vault_replicas        = var.vault_replicas
  vault_kms_type        = var.vault_kms_type
  vault_kms_config      = var.vault_kms_config

  vault_backup_passphrase = var.vault_backup_passphrase
  backup_s3_bucket        = var.backup_s3_bucket
  backup_s3_endpoint      = var.backup_s3_endpoint
  backup_s3_region        = var.backup_s3_region
  backup_image_tag        = var.backup_image_tag
  depends_on              = [scaleway_k8s_pool.app, scaleway_k8s_pool.data, scaleway_k8s_acl.this]
}
