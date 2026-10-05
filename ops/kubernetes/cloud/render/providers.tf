provider "kubernetes" {
  host     = "https://127.0.0.1:1"
  insecure = true
  token    = "render-only"
}

provider "helm" {
  kubernetes = {
    host     = "https://127.0.0.1:1"
    insecure = true
    token    = "render-only"
  }
}

provider "kubectl" {
  host             = "https://127.0.0.1:1"
  insecure         = true
  token            = "render-only"
  load_config_file = false
}

provider "vault" {
  address          = "https://127.0.0.1:1"
  token            = "render-only"
  skip_child_token = true
  skip_tls_verify  = true
}
