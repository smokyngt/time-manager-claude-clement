path "secret/data/app/time-manager" {
  capabilities = ["patch", "read", "update"]
}

path "secret/data/databases/postgres" {
  capabilities = ["read"]
}

path "transit/decrypt/time-manager-content-kek" {
  capabilities = ["create", "update"]
}

path "transit/encrypt/time-manager-content-kek" {
  capabilities = ["create", "update"]
}

path "transit/rewrap/time-manager-content-kek" {
  capabilities = ["create", "update"]
}

path "transit/keys/time-manager-content-kek" {
  capabilities = ["read"]
}

path "transit/keys/time-manager-content-kek/rotate" {
  capabilities = ["update"]
}

path "transit/decrypt/time-manager-hash-kek" {
  capabilities = ["create", "update"]
}

path "transit/encrypt/time-manager-hash-kek" {
  capabilities = ["create", "update"]
}

path "transit/rewrap/time-manager-hash-kek" {
  capabilities = ["create", "update"]
}

path "transit/keys/time-manager-hash-kek" {
  capabilities = ["read"]
}

path "transit/keys/time-manager-hash-kek/rotate" {
  capabilities = ["update"]
}

path "transit/decrypt/time-manager-pii-kek" {
  capabilities = ["create", "update"]
}

path "transit/encrypt/time-manager-pii-kek" {
  capabilities = ["create", "update"]
}

path "transit/rewrap/time-manager-pii-kek" {
  capabilities = ["create", "update"]
}

path "transit/keys/time-manager-pii-kek" {
  capabilities = ["read"]
}

path "transit/keys/time-manager-pii-kek/rotate" {
  capabilities = ["update"]
}

path "pki-internal/issue/api-server" {
  capabilities = ["create", "update"]
}
