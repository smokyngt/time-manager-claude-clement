output "kv_mount" {
  description = "KV v2 mount path."
  value       = vault_mount.kv.path
}

output "transit_keys" {
  description = "Transit KEK names by domain."
  value       = { for domain, key in vault_transit_secret_backend_key.kek : domain => key.name }
}

output "policies" {
  description = "Policy names."
  value       = sort(keys(vault_policy.this))
}

output "pki_internal_mount" {
  description = "Mount path of the internal intermediate CA."
  value       = vault_mount.pki_internal.path
}

output "pki_root_certificate" {
  description = "Public root CA certificate (PEM) to trust."
  value       = vault_pki_secret_backend_root_cert.root.certificate
}

output "grafana_oidc_client_id" {
  description = "Client id of the grafana OIDC client; the secret is read with vault read."
  value       = one(vault_identity_oidc_client.grafana[*].client_id)
}

output "grafana_oidc_issuer" {
  description = "Issuer URL of the grafana OIDC provider."
  value       = one(vault_identity_oidc_provider.grafana[*].issuer)
}
