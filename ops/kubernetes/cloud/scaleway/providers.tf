provider "scaleway" {
  region     = var.region
  zone       = var.zone
  project_id = var.project_id
}

provider "cloudflare" {}

provider "kubernetes" {
  host                   = scaleway_k8s_cluster.this.kubeconfig[0].host
  token                  = scaleway_k8s_cluster.this.kubeconfig[0].token
  cluster_ca_certificate = base64decode(scaleway_k8s_cluster.this.kubeconfig[0].cluster_ca_certificate)
}

provider "helm" {
  kubernetes = {
    host                   = scaleway_k8s_cluster.this.kubeconfig[0].host
    token                  = scaleway_k8s_cluster.this.kubeconfig[0].token
    cluster_ca_certificate = base64decode(scaleway_k8s_cluster.this.kubeconfig[0].cluster_ca_certificate)
  }
}

provider "kubectl" {
  host                   = scaleway_k8s_cluster.this.kubeconfig[0].host
  token                  = scaleway_k8s_cluster.this.kubeconfig[0].token
  cluster_ca_certificate = base64decode(scaleway_k8s_cluster.this.kubeconfig[0].cluster_ca_certificate)
  load_config_file       = false
}

provider "vault" {
  address          = var.vault_address
  ca_cert_file     = var.vault_ca_cert_file == "" ? null : var.vault_ca_cert_file
  skip_child_token = true
}
