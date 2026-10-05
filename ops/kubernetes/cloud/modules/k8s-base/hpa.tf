locals {
  scalable_components = {
    api = {
      deployment = local.api_name
      min        = var.autoscaling.api.min_replicas
      max        = var.autoscaling.api.max_replicas
      memory     = true
    }
    web = {
      deployment = local.web_name
      min        = var.autoscaling.web.min_replicas
      max        = var.autoscaling.web.max_replicas
      memory     = false
    }
  }

  scaling_sa      = "scaling-scheduler"
  scaling_phases  = var.scaling_schedule.enabled ? { "peak" = var.scaling_schedule.peak_cron, "off-peak" = var.scaling_schedule.off_peak_cron } : {}
  scaling_workers = { for pair in setproduct(keys(local.scalable_components), keys(local.scaling_phases)) : "${pair[0]}-${pair[1]}" => { component = pair[0], phase = pair[1] } }

  scaling_selector = {
    "app"                         = "scaling-scheduler"
    "app.kubernetes.io/component" = "scaling"
  }

  scaling_labels = merge(local.common_labels, {
    "app"                         = "scaling-scheduler"
    "app.kubernetes.io/name"      = "scaling-scheduler"
    "app.kubernetes.io/component" = "scaling"
  })

  prometheus_adapter_values = {
    replicas = 2
    prometheus = {
      url  = "http://${local.prometheus_service}.${local.ns.monitoring}.svc"
      port = 9090
    }
    podAnnotations      = { "linkerd.io/inject" = "disabled" }
    podDisruptionBudget = { enabled = true, maxUnavailable = 1 }
    priorityClassName   = kubernetes_priority_class_v1.critical.metadata[0].name
    resources = {
      requests = { cpu = "50m", memory = "64Mi" }
      limits   = { memory = "128Mi" }
    }
    rules = {
      default  = false
      resource = null
      custom = [{
        seriesQuery = "http_request_duration_seconds_count{namespace!=\"\",pod!=\"\"}"
        resources = {
          overrides = {
            namespace = { resource = "namespace" }
            pod       = { resource = "pod" }
          }
        }
        name         = { matches = "^http_request_duration_seconds_count$", as = "http_requests_per_second" }
        metricsQuery = "sum(rate(<<.Series>>{<<.LabelMatchers>>}[2m])) by (<<.GroupBy>>)"
      }]
    }
  }

  vpa_values = {
    recommender = {
      enabled        = true
      podAnnotations = { "linkerd.io/inject" = "disabled" }
    }
    updater             = { enabled = false }
    admissionController = { enabled = false }
  }

  hpa_metrics = { for k, c in local.scalable_components : k => concat(
    [{ type = "Resource", resource = { name = "cpu", target = { type = "Utilization", averageUtilization = 85 } } }],
    c.memory ? [{ type = "Resource", resource = { name = "memory", target = { type = "Utilization", averageUtilization = 85 } } }] : [],
    k == "api" && var.api_hpa_requests_per_second != null ? [{ type = "Pods", pods = { metric = { name = "http_requests_per_second" }, target = { type = "AverageValue", averageValue = tostring(var.api_hpa_requests_per_second) } } }] : [],
  ) }

  hpa_manifests = { for k, c in local.scalable_components : k => <<-YAML
    apiVersion: autoscaling/v2
    kind: HorizontalPodAutoscaler
    metadata:
      name: ${c.deployment}
      namespace: ${local.app_ns}
      labels:
        ${indent(4, yamlencode(local.workload_labels[k]))}
    spec:
      scaleTargetRef:
        apiVersion: apps/v1
        kind: Deployment
        name: ${c.deployment}
      minReplicas: ${c.min}
      maxReplicas: ${c.max}
      metrics:
        ${indent(4, yamlencode(local.hpa_metrics[k]))}
      behavior:
        scaleUp:
          stabilizationWindowSeconds: 60
          selectPolicy: Max
          policies:
            - type: Pods
              value: 2
              periodSeconds: 60
        scaleDown:
          stabilizationWindowSeconds: 300
          selectPolicy: Max
          policies:
            - type: Pods
              value: 1
              periodSeconds: 120
  YAML
  }

  vpa_manifests = { for k, c in local.scalable_components : k => <<-YAML
    apiVersion: autoscaling.k8s.io/v1
    kind: VerticalPodAutoscaler
    metadata:
      name: ${c.deployment}
      namespace: ${local.app_ns}
      labels:
        ${indent(4, yamlencode(local.workload_labels[k]))}
    spec:
      targetRef:
        apiVersion: apps/v1
        kind: Deployment
        name: ${c.deployment}
      updatePolicy:
        updateMode: "Off"
      resourcePolicy:
        containerPolicies:
          - containerName: ${c.deployment}
            controlledResources:
              - cpu
              - memory
  YAML
  }

  scaling_cronjob_manifests = { for k, w in local.scaling_workers : k => <<-YAML
    apiVersion: batch/v1
    kind: CronJob
    metadata:
      name: scale-${k}
      namespace: ${local.app_ns}
      labels:
        ${indent(4, yamlencode(local.scaling_labels))}
    spec:
      schedule: "${local.scaling_phases[w.phase]}"
      timeZone: ${var.scaling_schedule.timezone}
      concurrencyPolicy: Forbid
      startingDeadlineSeconds: 600
      successfulJobsHistoryLimit: 1
      failedJobsHistoryLimit: 3
      jobTemplate:
        spec:
          backoffLimit: 2
          activeDeadlineSeconds: 120
          ttlSecondsAfterFinished: 3600
          template:
            metadata:
              labels:
                ${indent(12, yamlencode(local.scaling_labels))}
              annotations:
                linkerd.io/inject: disabled
            spec:
              serviceAccountName: ${local.scaling_sa}
              automountServiceAccountToken: true
              restartPolicy: Never
              priorityClassName: low
              securityContext:
                runAsNonRoot: true
                runAsUser: 65532
                runAsGroup: 65532
                seccompProfile:
                  type: RuntimeDefault
              imagePullSecrets: []
              containers:
                - name: kubectl
                  image: ${var.kubectl_image}
                  imagePullPolicy: IfNotPresent
                  args:
                    - patch
                    - hpa
                    - ${local.scalable_components[w.component].deployment}
                    - --namespace=${local.app_ns}
                    - --type=merge
                    - ${jsonencode("--patch={\"spec\":{\"minReplicas\":${w.phase == "peak" ? local.scalable_components[w.component].min : min(var.off_peak_min_replicas, local.scalable_components[w.component].min)}}}")}
                  env:
                    - name: HOME
                      value: /tmp
                    - name: KUBECACHEDIR
                      value: /tmp/.kube-cache
                  securityContext:
                    allowPrivilegeEscalation: false
                    readOnlyRootFilesystem: true
                    runAsNonRoot: true
                    capabilities:
                      drop:
                        - ALL
                  resources:
                    requests:
                      cpu: 10m
                      memory: 32Mi
                    limits:
                      memory: 64Mi
                  volumeMounts:
                    - name: tmp
                      mountPath: /tmp
              volumes:
                - name: tmp
                  emptyDir:
                    sizeLimit: 16Mi
  YAML
  }

  scaling_netpol_manifest = yamlencode({
    apiVersion = "networking.k8s.io/v1"
    kind       = "NetworkPolicy"
    metadata = {
      name      = "allow-scaling-to-kube-api"
      namespace = local.app_ns
      labels    = local.common_labels
    }
    spec = {
      podSelector = { matchLabels = local.scaling_selector }
      policyTypes = ["Egress"]
      egress = [{
        to    = [for c in var.kube_api_cidrs : { ipBlock = { cidr = c } }]
        ports = [for p in var.kube_api_ports : { port = p, protocol = "TCP" }]
      }]
    }
  })
}

resource "helm_release" "prometheus_adapter" {
  name       = "prometheus-adapter"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "prometheus-adapter"
  version    = local.chart_versions["prometheus-adapter"]
  namespace  = local.ns.monitoring

  wait            = true
  timeout         = 600
  atomic          = true
  cleanup_on_fail = true

  values = [yamlencode(local.prometheus_adapter_values)]

  depends_on = [
    kubernetes_namespace_v1.this,
    kubernetes_priority_class_v1.critical,
    helm_release.kube_prometheus_stack,
  ]
}

resource "helm_release" "vpa" {
  name       = "vpa"
  repository = "https://charts.fairwinds.com/stable"
  chart      = "vpa"
  version    = local.chart_versions["vpa"]
  namespace  = local.ns.monitoring

  wait            = true
  timeout         = 600
  atomic          = true
  cleanup_on_fail = true

  values = [yamlencode(local.vpa_values)]

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubectl_manifest" "hpa" {
  for_each = local.hpa_manifests

  yaml_body     = each.value
  ignore_fields = ["spec.minReplicas"]

  depends_on = [kubectl_manifest.api_deployment, kubectl_manifest.web_deployment, helm_release.prometheus_adapter]
}

resource "kubectl_manifest" "vpa" {
  for_each = local.vpa_manifests

  yaml_body = each.value

  depends_on = [
    kubectl_manifest.api_deployment,
    kubectl_manifest.web_deployment,
    helm_release.vpa,
  ]
}

resource "kubernetes_service_account_v1" "scaling_scheduler" {
  metadata {
    name      = local.scaling_sa
    namespace = local.app_ns
    labels    = local.scaling_labels
  }
  automount_service_account_token = true

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_role_v1" "scaling_scheduler" {
  metadata {
    name      = local.scaling_sa
    namespace = local.app_ns
    labels    = local.scaling_labels
  }

  rule {
    api_groups     = ["autoscaling"]
    resources      = ["horizontalpodautoscalers"]
    resource_names = [for c in local.scalable_components : c.deployment]
    verbs          = ["get", "patch"]
  }
}

resource "kubernetes_role_binding_v1" "scaling_scheduler" {
  metadata {
    name      = local.scaling_sa
    namespace = local.app_ns
    labels    = local.scaling_labels
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role_v1.scaling_scheduler.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account_v1.scaling_scheduler.metadata[0].name
    namespace = local.app_ns
  }
}

resource "kubectl_manifest" "scaling_network_policy" {
  yaml_body = local.scaling_netpol_manifest

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubectl_manifest" "scaling_cronjob" {
  for_each = local.scaling_cronjob_manifests

  yaml_body = each.value

  depends_on = [
    kubernetes_role_binding_v1.scaling_scheduler,
    kubectl_manifest.hpa,
    kubectl_manifest.scaling_network_policy,
  ]
}
