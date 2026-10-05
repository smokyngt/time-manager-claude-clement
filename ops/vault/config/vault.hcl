ui                = false
disable_mlock     = false
log_level         = "info"
api_addr          = "http://vault:8200"
cluster_addr      = "http://vault:8201"
max_lease_ttl     = "768h"
default_lease_ttl = "1h"

storage "raft" {
  path    = "/vault/file"
  node_id = "vault-1"
}

listener "tcp" {
  address         = "0.0.0.0:8200"
  cluster_address = "0.0.0.0:8201"
  tls_disable     = true
}

telemetry {
  disable_hostname          = true
  prometheus_retention_time = "0s"
}
