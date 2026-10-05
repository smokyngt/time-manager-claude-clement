path "secret/data/time-manager/*" {
  capabilities = ["create", "read", "update"]
}

path "secret/metadata/time-manager/*" {
  capabilities = ["list", "read"]
}

path "secret/delete/time-manager/*" {
  capabilities = ["update"]
}

path "secret/undelete/time-manager/*" {
  capabilities = ["update"]
}

path "auth/approle/role/time-manager-api/role-id" {
  capabilities = ["read"]
}

path "auth/approle/role/time-manager-api/secret-id" {
  capabilities = ["list", "update"]
}

path "auth/approle/role/time-manager-api/secret-id-accessor/destroy" {
  capabilities = ["update"]
}

path "auth/approle/role/time-manager-api/secret-id-accessor/lookup" {
  capabilities = ["update"]
}

path "auth/approle/role/time-manager-backup/role-id" {
  capabilities = ["read"]
}

path "auth/approle/role/time-manager-backup/secret-id" {
  capabilities = ["list", "update"]
}

path "auth/approle/role/time-manager-backup/secret-id-accessor/destroy" {
  capabilities = ["update"]
}

path "auth/approle/role/time-manager-backup/secret-id-accessor/lookup" {
  capabilities = ["update"]
}

path "sys/policies/acl" {
  capabilities = ["list"]
}

path "sys/policies/acl/time-manager-*" {
  capabilities = ["create", "delete", "read", "update"]
}
