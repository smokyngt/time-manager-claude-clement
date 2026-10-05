output "app_domain" {
  value = local.app_domain
}

output "hosts" {
  value = local.hosts
}

output "namespaces" {
  value = local.ns
}

output "chart_versions" {
  value = local.chart_versions
}

output "vault_url" {
  value = local.vault_url
}

output "public_cluster_issuer" {
  value = local.public_issuer
}

output "traefik_load_balancer_ip" {
  value = try(data.kubernetes_service_v1.traefik.status[0].load_balancer[0].ingress[0].ip, null)
}

output "traefik_load_balancer_hostname" {
  value = try(data.kubernetes_service_v1.traefik.status[0].load_balancer[0].ingress[0].hostname, null)
}

output "transit_keys" {
  value = local.transit_key_names
}

output "ca_bundle_secret" {
  value = local.ca_bundle_secret
}
