module "k8s_base" {
  source = "./modules/k8s-base"

  app_namespace                     = var.app_namespace
  enable_vault_config               = var.enable_vault_config
  app_host                          = var.app_host
  grafana_host                      = var.grafana_host
  acme_email                        = var.acme_email
  seed_admin_email                  = var.seed_admin_email
  data_node_selector                = var.data_node_selector
  data_tolerations                  = var.data_tolerations
  storage_class                     = var.storage_class
  vault_kms_type                    = var.vault_kms_type
  vault_kms_config                  = var.vault_kms_config
  vault_service_account_annotations = var.vault_service_account_annotations
  grafana_oidc_enabled              = var.grafana_oidc_enabled
  vault_oidc_issuer_host            = var.vault_oidc_issuer_host
  postgres_backup_destination       = var.postgres_backup_destination
  postgres_backup_endpoint_url      = var.postgres_backup_endpoint_url
  alertmanager_webhook_enabled      = var.alertmanager_webhook_enabled
  ingress_service_annotations       = var.ingress_service_annotations
  kube_api_cidrs                    = var.kube_api_cidrs
}
