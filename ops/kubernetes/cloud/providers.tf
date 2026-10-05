provider "kubernetes" {
  config_path    = var.kubeconfig_path
  config_context = var.kube_context
}

provider "helm" {
  kubernetes {
    config_path    = var.kubeconfig_path
    config_context = var.kube_context
  }
}

provider "kubectl" {
  config_path      = var.kubeconfig_path
  config_context   = var.kube_context
  load_config_file = true
}

provider "vault" {
  address          = var.vault_address
  ca_cert_file     = var.vault_ca_cert_file
  skip_child_token = true
}

provider "random" {}
