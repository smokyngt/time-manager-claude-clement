output "cluster_id" {
  value = scaleway_k8s_cluster.this.id
}

output "cluster_name" {
  value = scaleway_k8s_cluster.this.name
}

output "apiserver_url" {
  value = scaleway_k8s_cluster.this.apiserver_url
}

output "image_registry" {
  value = scaleway_registry_namespace.this.endpoint
}

output "hosts" {
  value = module.k8s_base.hosts
}

output "traefik_load_balancer_ip" {
  value = module.k8s_base.traefik_load_balancer_ip
}

output "namespaces" {
  value = module.k8s_base.namespaces
}
