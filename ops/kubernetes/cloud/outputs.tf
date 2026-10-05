output "namespaces" {
  value = module.k8s_base.namespaces
}

output "vault_address" {
  value = module.k8s_base.vault_address
}

output "api_vault_role" {
  value = module.k8s_base.api_vault_role
}

output "api_env_configmap" {
  value = module.k8s_base.api_env_configmap
}

output "vault_ca_bundle_secret" {
  value = module.k8s_base.vault_ca_bundle_secret
}

output "postgres_cluster" {
  value = module.k8s_base.postgres_cluster
}
