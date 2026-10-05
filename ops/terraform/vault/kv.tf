resource "vault_kv_secret_v2" "placeholder" {
  for_each = var.placeholder_documents

  mount     = vault_mount.kv.path
  name      = each.key
  data_json = jsonencode({ placeholder = "CHANGE_ME" })

  lifecycle {
    ignore_changes = [data_json, custom_metadata]
  }
}
