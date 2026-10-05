module "k8s_base" {
  source = "../modules/k8s-base"

  providers = {
    kubernetes = kubernetes
    helm       = helm
    kubectl    = kubectl
    vault      = vault
  }

  tenant                = "render"
  base_domain           = "example.com"
  image_registry        = "registry.example.com/time-manager"
  storage_class_default = "standard"
  storage_class_retain  = "standard-retain"
  public_certificates   = "letsencrypt"
  acme_email            = "ops@example.com"
  admin_allowed_cidrs   = ["192.0.2.0/24"]

  features = {
    grafana_oidc     = true
    vault_ui_exposed = true
    kyverno          = true
  }
}
