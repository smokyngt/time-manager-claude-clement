path "secret/data/backup/*" {
  capabilities = ["read"]
}

path "secret/data/databases/postgres" {
  capabilities = ["read"]
}
