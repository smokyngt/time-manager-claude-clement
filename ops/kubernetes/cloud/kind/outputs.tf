output "kubeconfig_path" {
  value = kind_cluster.this.kubeconfig_path
}

output "hosts" {
  value = module.k8s_base.hosts
}

output "namespaces" {
  value = module.k8s_base.namespaces
}
