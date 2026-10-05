resource "vault_mount" "kv" {
  path        = var.kv_mount_path
  type        = "kv"
  options     = { version = "2" }
  description = "Time Manager configuration and secrets"
}

resource "vault_mount" "transit" {
  path        = var.transit_mount_path
  type        = "transit"
  description = "Time Manager envelope encryption KEKs"
}
