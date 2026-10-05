output "namespaces" {
  value = local.ns
}

output "vault_address" {
  value = local.vault_address
}

output "api_vault_role" {
  value = local.api_vault_role
}

output "api_env_configmap" {
  value = local.api_env_configmap
}

output "vault_ca_bundle_secret" {
  value = local.vault_ca_bundle_name
}

output "transit_keys" {
  value = local.transit_key_names
}

output "postgres_cluster" {
  value = local.postgres_cluster_name
}

output "public_cluster_issuer" {
  value = local.public_cluster_issuer
}
