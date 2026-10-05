resource "vault_transit_secret_backend_key" "kek" {
  for_each = var.key_domains

  backend                = vault_mount.transit.path
  name                   = "time-manager-${each.key}-kek"
  type                   = "aes256-gcm96"
  deletion_allowed       = false
  exportable             = false
  allow_plaintext_backup = false
}
