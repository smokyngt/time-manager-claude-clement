resource "vault_audit" "stdout" {
  count = var.audit_enabled ? 1 : 0

  type = "file"

  options = {
    file_path = "stdout"
  }
}
