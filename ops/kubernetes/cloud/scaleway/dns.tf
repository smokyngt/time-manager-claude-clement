resource "cloudflare_dns_record" "public" {
  for_each = var.cloudflare_zone_id == "" ? toset([]) : toset(["web", "api", "grafana", "vault"])

  zone_id = var.cloudflare_zone_id
  name    = module.k8s_base.hosts[each.key]
  type    = module.k8s_base.traefik_load_balancer_ip == null ? "CNAME" : "A"
  content = coalesce(module.k8s_base.traefik_load_balancer_ip, module.k8s_base.traefik_load_balancer_hostname, "pending.invalid")
  proxied = var.dns_proxied
  ttl     = 1
  comment = "managed by terraform: time-manager ${var.tenant}"

  lifecycle {
    precondition {
      condition     = module.k8s_base.traefik_load_balancer_ip != null || module.k8s_base.traefik_load_balancer_hostname != null
      error_message = "The Traefik Service has no external address yet. What breaks: DNS would point at a placeholder and the site is unreachable. Why: the Scaleway load balancer is still provisioning. Fixes: (1) wait a minute and apply again; (2) check kubectl -n traefik get svc traefik; (3) check the load balancer quota of the project."
    }
  }
}
