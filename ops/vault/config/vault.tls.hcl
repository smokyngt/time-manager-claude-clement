ui                = false
disable_mlock     = false
log_level         = "info"
api_addr          = "https://vault:8200"
cluster_addr      = "https://vault:8201"
max_lease_ttl     = "768h"
default_lease_ttl = "1h"

storage "raft" {
  path    = "/vault/file"
  node_id = "vault-1"
}

listener "tcp" {
  address                  = "0.0.0.0:8200"
  cluster_address          = "0.0.0.0:8201"
  tls_cert_file            = "/vault/tls/tls.crt"
  tls_disable              = false
  tls_disable_client_certs = true
  tls_key_file             = "/vault/tls/tls.key"
  tls_min_version          = "tls12"
}

telemetry {
  disable_hostname          = true
  prometheus_retention_time = "0s"
}
