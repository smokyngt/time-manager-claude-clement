path "auth/token/*" {
  capabilities = ["create", "delete", "list", "read", "sudo", "update"]
}

path "identity/*" {
  capabilities = ["create", "delete", "list", "read", "update"]
}

path "pki-internal/*" {
  capabilities = ["create", "delete", "list", "read", "sudo", "update"]
}

path "pki-root/*" {
  capabilities = ["create", "delete", "list", "read", "sudo", "update"]
}

path "secret/*" {
  capabilities = ["create", "delete", "list", "patch", "read", "update"]
}

path "sys/audit" {
  capabilities = ["read"]
}

path "sys/auth" {
  capabilities = ["read"]
}

path "sys/health" {
  capabilities = ["read"]
}

path "sys/mounts" {
  capabilities = ["read"]
}

path "sys/policies/acl/*" {
  capabilities = ["create", "delete", "list", "read", "update"]
}

path "sys/storage/raft/snapshot" {
  capabilities = ["read"]
}

path "transit/*" {
  capabilities = ["create", "delete", "list", "read", "update"]
}
