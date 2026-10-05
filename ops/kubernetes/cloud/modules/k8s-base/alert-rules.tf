locals {
  rules_dir          = "${local.obs_dir}/prometheus/rules"
  compose_rule_files = sort(fileset(local.rules_dir, "*.yml"))

  rule_specs = merge(
    {
      for f in local.compose_rule_files : "tm-${trimsuffix(f, ".yml")}" => {
        groups = [
          for g in yamldecode(file("${local.rules_dir}/${f}")).groups : g
          if !contains(var.monitoring_excluded_rule_groups, g.name)
        ]
      }
    },
    { "tm-kubernetes" = yamldecode(file("${path.module}/files/alerts-kubernetes.yml")) },
  )

  prometheus_rule_manifests = { for name, spec in local.rule_specs : name => <<-YAML
    apiVersion: monitoring.coreos.com/v1
    kind: PrometheusRule
    metadata:
      name: ${name}
      namespace: ${local.mon_ns}
      labels: ${jsonencode(local.monitor_labels)}
    spec: ${jsonencode(spec)}
  YAML
  }
}

resource "kubectl_manifest" "prometheus_rule" {
  for_each = local.prometheus_rule_manifests

  yaml_body = each.value

  depends_on = [helm_release.kube_prometheus_stack]
}
