locals {
  app_ns        = local.ns.app
  api_name      = "api"
  web_name      = "web"
  mesh_proxy_in = 4143
  mesh_admin_in = 4191

  workloads = {
    api = {
      name         = local.api_name
      uid          = 65532
      port         = 8000
      port_name    = "api"
      image        = "${var.image_registry}/${var.api_image_name}:${var.api_image_tag}"
      priority     = var.api_priority_class
      replicas     = var.api_replicas
      prestop      = var.api_prestop_sleep_seconds
      resources    = var.api_resources
      service_port = 8000
    }
    web = {
      name         = local.web_name
      uid          = 101
      port         = 8080
      port_name    = "http"
      image        = "${var.image_registry}/${var.web_image_name}:${var.web_image_tag}"
      priority     = var.web_priority_class
      replicas     = var.web_replicas
      prestop      = var.web_prestop_sleep_seconds
      resources    = var.web_resources
      service_port = 8080
    }
  }

  workload_selector = { for k, w in local.workloads : k => {
    "app"                         = w.name
    "app.kubernetes.io/component" = "server"
  } }

  workload_labels = { for k, w in local.workloads : k => merge(local.common_labels, {
    "app"                         = w.name
    "app.kubernetes.io/name"      = w.name
    "app.kubernetes.io/component" = "server"
  }) }

  image_pull_secrets = nonsensitive(var.registry_credentials != null) ? [{ name = var.image_pull_secret }] : []

  container_security_context = { for k, w in local.workloads : k => {
    allowPrivilegeEscalation = false
    readOnlyRootFilesystem   = true
    runAsNonRoot             = true
    runAsUser                = w.uid
    runAsGroup               = w.uid
    capabilities             = { drop = ["ALL"] }
    seccompProfile           = { type = "RuntimeDefault" }
  } }

  pod_security_context = { for k, w in local.workloads : k => {
    runAsNonRoot        = true
    runAsUser           = w.uid
    runAsGroup          = w.uid
    fsGroup             = w.uid
    fsGroupChangePolicy = "OnRootMismatch"
    seccompProfile      = { type = "RuntimeDefault" }
  } }

  container_resources = { for k, w in local.workloads : k => {
    requests = { for rk, rv in w.resources.requests : rk => rv if rv != null }
    limits   = { for rk, rv in w.resources.limits : rk => rv if rv != null }
  } }

  migration_resources = {
    requests = { for rk, rv in var.migration_resources.requests : rk => rv if rv != null }
    limits   = { for rk, rv in var.migration_resources.limits : rk => rv if rv != null }
  }

  api_scheme    = var.api_tls_enabled ? "HTTPS" : "HTTP"
  api_alt_names = ["api", "api.${local.app_ns}", "api.${local.app_ns}.svc", "localhost"]

  api_env_configmap = "api-env"
  api_vault_role    = "time-manager-api"
  api_ca_mount      = "/etc/vault-ca"
  api_ca_file       = "${local.api_ca_mount}/ca.crt"
  api_otlp_endpoint = local.otlp_endpoint_http

  api_env = merge(
    {
      NODE_ENV                    = "production"
      PORT                        = "8000"
      VAULT_AUTH_METHOD           = "kubernetes"
      VAULT_K8S_ROLE              = local.api_vault_role
      VAULT_K8S_MOUNT             = local.vault_auth_path
      VAULT_URL                   = local.vault_url
      VAULT_CACERT                = local.api_ca_file
      NODE_EXTRA_CA_CERTS         = local.api_ca_file
      VAULT_SECRETS_PATH          = var.vault_secrets_path
      VAULT_DATABASE_PATH         = var.vault_database_secret_path
      VAULT_PKI_ENABLED           = tostring(var.api_tls_enabled)
      VAULT_PKI_MOUNT             = vault_mount.pki_internal.path
      VAULT_PKI_ROLE              = vault_pki_secret_backend_role.api_server.name
      VAULT_PKI_COMMON_NAME       = local.api_service_dns
      VAULT_PKI_ALT_NAMES         = join(",", local.api_alt_names)
      VAULT_PKI_IP_SANS           = "127.0.0.1"
      VAULT_PKI_TTL               = "24h"
      OTEL_SERVICE_NAME           = "time-manager-api"
      OTEL_EXPORTER_OTLP_ENDPOINT = local.api_otlp_endpoint
      OTEL_EXPORTER_OTLP_PROTOCOL = "http/protobuf"
      OTEL_TRACES_SAMPLER         = "parentbased_traceidratio"
      OTEL_TRACES_SAMPLER_ARG     = "0.1"
      TMPDIR                      = "/tmp"
    },
    var.api_extra_env,
  )

  api_config_checksum = sha256(jsonencode(local.api_env))
  ca_bundle_checksum  = nonsensitive(sha256(kubernetes_secret_v1.ca_bundle["app"].data[local.ca_bundle_key]))

  api_transit_policy_paths = flatten([
    for name in values(local.transit_key_names) : [
      { path = "transit/encrypt/${name}", capabilities = ["create", "update"] },
      { path = "transit/decrypt/${name}", capabilities = ["create", "update"] },
      { path = "transit/rewrap/${name}", capabilities = ["create", "update"] },
      { path = "transit/keys/${name}/rotate", capabilities = ["update"] },
      { path = "transit/keys/${name}", capabilities = ["read"] },
    ]
  ])

  api_policy_paths = concat(
    [
      { path = var.vault_secrets_path, capabilities = ["read", "update"] },
      { path = var.vault_database_secret_path, capabilities = ["read"] },
      { path = "${vault_mount.pki_internal.path}/issue/${vault_pki_secret_backend_role.api_server.name}", capabilities = ["create", "update"] },
    ],
    local.api_transit_policy_paths,
  )

  api_policy = join("\n", [
    for p in local.api_policy_paths : "path \"${p.path}\" {\n  capabilities = ${jsonencode(p.capabilities)}\n}\n"
  ])

  migrate_slug = trim(substr(lower(replace(var.api_image_tag, "/[^A-Za-z0-9]+/", "-")), 0, 40), "-")
  migrate_name = "api-migrate-${local.migrate_slug}"

  api_pod_annotations = {
    "prometheus.io/scrape" = "true"
    "prometheus.io/port"   = "8000"
    "prometheus.io/path"   = "/metrics"
    "prometheus.io/scheme" = lower(local.api_scheme)
    "checksum/config"      = local.api_config_checksum
    "checksum/ca-bundle"   = local.ca_bundle_checksum
  }

  tmp_volume = { name = "tmp", emptyDir = { sizeLimit = "64Mi" } }
  ca_volume = {
    name   = "vault-ca"
    secret = { secretName = local.ca_bundle_secret, defaultMode = 292, items = [{ key = "ca.crt", path = "ca.crt" }] }
  }

  wait_vault_container = {
    name            = "wait-vault"
    image           = var.wait_vault_image
    imagePullPolicy = "IfNotPresent"
    command         = ["/bin/sh", "-c"]
    args            = ["until curl --fail --silent --show-error --max-time 3 --cacert ${local.api_ca_file} \"$${VAULT_URL}/v1/sys/health?standbyok=true\" --output /dev/null; do echo \"waiting for vault\"; sleep 3; done"]
    envFrom         = [{ configMapRef = { name = local.api_env_configmap } }]
    securityContext = {
      allowPrivilegeEscalation = false
      readOnlyRootFilesystem   = true
      runAsNonRoot             = true
      runAsUser                = 65534
      runAsGroup               = 65534
      capabilities             = { drop = ["ALL"] }
      seccompProfile           = { type = "RuntimeDefault" }
    }
    resources    = { requests = { cpu = "10m", memory = "16Mi" }, limits = { memory = "32Mi" } }
    volumeMounts = [{ name = "vault-ca", mountPath = local.api_ca_mount, readOnly = true }, { name = "tmp", mountPath = "/tmp" }]
  }

  api_env_downward = [
    { name = "POD_NAME", valueFrom = { fieldRef = { fieldPath = "metadata.name" } } },
    { name = "POD_NAMESPACE", valueFrom = { fieldRef = { fieldPath = "metadata.namespace" } } },
    { name = "NODE_NAME", valueFrom = { fieldRef = { fieldPath = "spec.nodeName" } } },
    { name = "OTEL_RESOURCE_ATTRIBUTES", value = "service.namespace=time-manager,k8s.namespace.name=$(POD_NAMESPACE),k8s.pod.name=$(POD_NAME),k8s.node.name=$(NODE_NAME)" },
  ]

  api_container = {
    name            = "api"
    image           = local.workloads.api.image
    imagePullPolicy = "IfNotPresent"
    ports           = [{ name = "api", containerPort = 8000, protocol = "TCP" }]
    envFrom         = [{ configMapRef = { name = local.api_env_configmap } }]
    env             = local.api_env_downward
    securityContext = local.container_security_context.api
    resources       = local.container_resources.api
    startupProbe = {
      httpGet             = { path = "/health/ready", port = "api", scheme = local.api_scheme }
      periodSeconds       = 5
      timeoutSeconds      = 3
      failureThreshold    = var.api_startup_failure_threshold
      successThreshold    = 1
      initialDelaySeconds = 2
    }
    readinessProbe = {
      httpGet          = { path = "/health/ready", port = "api", scheme = local.api_scheme }
      periodSeconds    = 10
      timeoutSeconds   = 3
      failureThreshold = 3
      successThreshold = 1
    }
    livenessProbe = {
      httpGet          = { path = "/health", port = "api", scheme = local.api_scheme }
      periodSeconds    = 20
      timeoutSeconds   = 3
      failureThreshold = 3
    }
    lifecycle    = { preStop = { sleep = { seconds = var.api_prestop_sleep_seconds } } }
    volumeMounts = [{ name = "tmp", mountPath = "/tmp" }, { name = "vault-ca", mountPath = local.api_ca_mount, readOnly = true }]
  }

  web_container = {
    name            = "web"
    image           = local.workloads.web.image
    imagePullPolicy = "IfNotPresent"
    ports           = [{ name = "http", containerPort = 8080, protocol = "TCP" }]
    securityContext = local.container_security_context.web
    resources       = local.container_resources.web
    startupProbe = {
      httpGet          = { path = "/healthz", port = "http" }
      periodSeconds    = 3
      timeoutSeconds   = 2
      failureThreshold = 20
    }
    readinessProbe = {
      httpGet          = { path = "/healthz", port = "http" }
      periodSeconds    = 10
      timeoutSeconds   = 2
      failureThreshold = 3
    }
    livenessProbe = {
      httpGet          = { path = "/healthz", port = "http" }
      periodSeconds    = 20
      timeoutSeconds   = 2
      failureThreshold = 3
    }
    lifecycle    = { preStop = { sleep = { seconds = var.web_prestop_sleep_seconds } } }
    volumeMounts = [{ name = "tmp", mountPath = "/tmp" }]
  }

  migrate_container = {
    name            = "migrate"
    image           = local.workloads.api.image
    imagePullPolicy = "IfNotPresent"
    args            = ["dist/db/migrate.js"]
    envFrom         = [{ configMapRef = { name = local.api_env_configmap } }]
    env             = local.api_env_downward
    securityContext = local.container_security_context.api
    resources       = local.migration_resources
    volumeMounts    = [{ name = "tmp", mountPath = "/tmp" }, { name = "vault-ca", mountPath = local.api_ca_mount, readOnly = true }]
  }

  pod_anti_affinity = { for k, w in local.workloads : k => {
    preferredDuringSchedulingIgnoredDuringExecution = [{
      weight = 100
      podAffinityTerm = {
        topologyKey   = "kubernetes.io/hostname"
        labelSelector = { matchLabels = local.workload_selector[k] }
      }
    }]
  } }

  public_hosts = { for k, host in local.hosts : k => host if contains(["web", "api"], k) && (k == "web" || var.expose_api_publicly) }
}

resource "vault_policy" "time_manager_api" {
  name   = "time-manager-api"
  policy = local.api_policy

  depends_on = [terraform_data.vault_ready]
}

resource "vault_kubernetes_auth_backend_role" "api" {
  backend                          = vault_auth_backend.kubernetes.path
  role_name                        = local.api_vault_role
  bound_service_account_names      = [local.api_name]
  bound_service_account_namespaces = [local.app_ns]
  token_policies                   = [vault_policy.time_manager_api.name]
  token_ttl                        = 3600
  token_max_ttl                    = 86400

  depends_on = [vault_kubernetes_auth_backend_config.this]
}

resource "kubernetes_service_account_v1" "api" {
  metadata {
    name      = local.api_name
    namespace = local.app_ns
    labels    = local.workload_labels.api
  }
  automount_service_account_token = true

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_service_account_v1" "web" {
  metadata {
    name      = local.web_name
    namespace = local.app_ns
    labels    = local.workload_labels.web
  }
  automount_service_account_token = false

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_config_map_v1" "api_env" {
  metadata {
    name      = local.api_env_configmap
    namespace = local.app_ns
    labels    = local.workload_labels.api
  }

  data = local.api_env

  depends_on = [kubernetes_namespace_v1.this]
}

locals {
  api_migrate_manifest = <<-YAML
    apiVersion: batch/v1
    kind: Job
    metadata:
      name: ${local.migrate_name}
      namespace: ${local.app_ns}
      labels:
        ${indent(4, yamlencode(merge(local.common_labels, { "app" = local.api_name, "app.kubernetes.io/name" = local.api_name, "app.kubernetes.io/component" = "migrate" })))}
    spec:
      backoffLimit: 2
      activeDeadlineSeconds: ${var.migration_deadline_seconds}
      ttlSecondsAfterFinished: ${var.migration_ttl_seconds}
      template:
        metadata:
          labels:
            ${indent(8, yamlencode(merge(local.common_labels, { "app" = local.api_name, "app.kubernetes.io/name" = local.api_name, "app.kubernetes.io/component" = "migrate" })))}
          annotations:
            linkerd.io/inject: disabled
        spec:
          serviceAccountName: ${local.api_name}
          automountServiceAccountToken: true
          restartPolicy: Never
          priorityClassName: ${var.api_priority_class}
          securityContext:
            ${indent(8, yamlencode(local.pod_security_context.api))}
          imagePullSecrets: ${jsonencode(local.image_pull_secrets)}
          initContainers:
            - ${indent(10, yamlencode(local.wait_vault_container))}
          containers:
            - ${indent(10, yamlencode(local.migrate_container))}
          volumes:
            - ${indent(10, yamlencode(local.tmp_volume))}
            - ${indent(10, yamlencode(local.ca_volume))}
  YAML

  api_deployment_manifest = <<-YAML
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: ${local.api_name}
      namespace: ${local.app_ns}
      labels:
        ${indent(4, yamlencode(local.workload_labels.api))}
    spec:
      replicas: ${local.workloads.api.replicas}
      revisionHistoryLimit: 3
      strategy:
        type: RollingUpdate
        rollingUpdate:
          maxSurge: 1
          maxUnavailable: 0
      selector:
        matchLabels:
          ${indent(6, yamlencode(local.workload_selector.api))}
      template:
        metadata:
          labels:
            ${indent(8, yamlencode(local.workload_labels.api))}
          annotations:
            ${indent(8, yamlencode({ for k, v in local.api_pod_annotations : k => v if v != "" }))}
        spec:
          serviceAccountName: ${local.api_name}
          automountServiceAccountToken: true
          priorityClassName: ${local.workloads.api.priority}
          terminationGracePeriodSeconds: 60
          securityContext:
            ${indent(8, yamlencode(local.pod_security_context.api))}
          affinity:
            podAntiAffinity:
              ${indent(10, yamlencode(local.pod_anti_affinity.api))}
          imagePullSecrets: ${jsonencode(local.image_pull_secrets)}
          initContainers:
            - ${indent(10, yamlencode(local.wait_vault_container))}
          containers:
            - ${indent(10, yamlencode(local.api_container))}
          volumes:
            - ${indent(10, yamlencode(local.tmp_volume))}
            - ${indent(10, yamlencode(local.ca_volume))}
  YAML

  web_deployment_manifest = <<-YAML
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: ${local.web_name}
      namespace: ${local.app_ns}
      labels:
        ${indent(4, yamlencode(local.workload_labels.web))}
    spec:
      replicas: ${local.workloads.web.replicas}
      revisionHistoryLimit: 3
      strategy:
        type: RollingUpdate
        rollingUpdate:
          maxSurge: 1
          maxUnavailable: 0
      selector:
        matchLabels:
          ${indent(6, yamlencode(local.workload_selector.web))}
      template:
        metadata:
          labels:
            ${indent(8, yamlencode(local.workload_labels.web))}
        spec:
          serviceAccountName: ${local.web_name}
          automountServiceAccountToken: false
          priorityClassName: ${local.workloads.web.priority}
          terminationGracePeriodSeconds: 60
          securityContext:
            ${indent(8, yamlencode(local.pod_security_context.web))}
          affinity:
            podAntiAffinity:
              ${indent(10, yamlencode(local.pod_anti_affinity.web))}
          imagePullSecrets: ${jsonencode(local.image_pull_secrets)}
          containers:
            - ${indent(10, yamlencode(local.web_container))}
          volumes:
            - ${indent(10, yamlencode(local.tmp_volume))}
  YAML
}

resource "kubectl_manifest" "api_migrate" {
  yaml_body        = local.api_migrate_manifest
  wait_for_rollout = false

  wait_for {
    condition {
      type   = "Complete"
      status = "True"
    }
  }

  depends_on = [
    kubernetes_service_account_v1.api,
    vault_kubernetes_auth_backend_role.api,
    kubernetes_config_map_v1.api_env,
    kubernetes_secret_v1.ca_bundle["app"],
    kubernetes_namespace_v1.this,
    helm_release.linkerd_control_plane,
  ]
}

resource "kubectl_manifest" "api_deployment" {
  yaml_body        = local.api_deployment_manifest
  wait_for_rollout = false
  ignore_fields    = ["spec.replicas"]

  depends_on = [
    kubernetes_service_account_v1.api,
    vault_kubernetes_auth_backend_role.api,
    kubernetes_config_map_v1.api_env,
    kubernetes_secret_v1.ca_bundle["app"],
    kubectl_manifest.api_migrate,
    kubernetes_namespace_v1.this,
    helm_release.linkerd_control_plane,
  ]
}

resource "kubectl_manifest" "web_deployment" {
  yaml_body        = local.web_deployment_manifest
  wait_for_rollout = false
  ignore_fields    = ["spec.replicas"]

  depends_on = [
    kubernetes_service_account_v1.web,
    kubernetes_namespace_v1.this,
    helm_release.linkerd_control_plane,
  ]
}

locals {
  service_manifests = { for k, w in local.workloads : k => <<-YAML
    apiVersion: v1
    kind: Service
    metadata:
      name: ${w.name}
      namespace: ${local.app_ns}
      labels:
        ${indent(4, yamlencode(local.workload_labels[k]))}
    spec:
      type: ClusterIP
      selector:
        ${indent(4, yamlencode(local.workload_selector[k]))}
      ports:
        - name: ${w.port_name}
          port: ${w.service_port}
          targetPort: ${w.port_name}
          protocol: TCP
  YAML
  }

  pdb_manifests = { for k, w in local.workloads : k => <<-YAML
    apiVersion: policy/v1
    kind: PodDisruptionBudget
    metadata:
      name: ${w.name}
      namespace: ${local.app_ns}
      labels:
        ${indent(4, yamlencode(local.workload_labels[k]))}
    spec:
      maxUnavailable: 1
      selector:
        matchLabels:
          ${indent(6, yamlencode(local.workload_selector[k]))}
  YAML
  }
}

resource "kubectl_manifest" "service" {
  for_each = local.service_manifests

  yaml_body = each.value

  depends_on = [
    kubectl_manifest.api_deployment,
    kubectl_manifest.web_deployment,
    kubernetes_namespace_v1.this,
  ]
}

resource "kubectl_manifest" "pdb" {
  for_each = local.pdb_manifests

  yaml_body = each.value

  depends_on = [
    kubectl_manifest.api_deployment,
    kubectl_manifest.web_deployment,
    kubernetes_namespace_v1.this,
  ]
}

locals {
  api_service_monitor_manifest = <<-YAML
    apiVersion: monitoring.coreos.com/v1
    kind: ServiceMonitor
    metadata:
      name: ${local.api_name}
      namespace: ${local.app_ns}
      labels:
        release: ${var.prometheus_release_label}
        ${indent(4, yamlencode(local.workload_labels.api))}
    spec:
      jobLabel: app
      namespaceSelector:
        matchNames:
          - ${local.app_ns}
      selector:
        matchLabels:
          ${indent(6, yamlencode(local.workload_selector.api))}
      endpoints:
        - port: api
          path: /metrics
          interval: 30s
          scrapeTimeout: 10s
          scheme: ${lower(local.api_scheme)}
          authorization:
            type: Bearer
            credentials:
              name: ${var.api_metrics_token_secret.name}
              key: ${var.api_metrics_token_secret.key}
          ${var.api_tls_enabled ? indent(10, yamlencode({ tlsConfig = { serverName = local.api_service_dns, ca = { secret = { name = local.ca_bundle_secret, key = "ca.crt" } } } })) : ""}
  YAML

  api_rules_manifest = <<-YAML
    apiVersion: monitoring.coreos.com/v1
    kind: PrometheusRule
    metadata:
      name: time-manager-api
      namespace: ${local.app_ns}
      labels:
        release: ${var.prometheus_release_label}
        ${indent(4, yamlencode(local.workload_labels.api))}
    spec:
      groups:
        - name: time-manager-api-workload
          rules:
            - alert: ApiPodsHighErrorRate
              expr: |
                sum(rate(http_request_duration_seconds_count{namespace="${local.app_ns}",job="${local.api_name}",status_code=~"5.."}[5m]))
                  / sum(rate(http_request_duration_seconds_count{namespace="${local.app_ns}",job="${local.api_name}"}[5m])) > 0.02
                and sum(rate(http_request_duration_seconds_count{namespace="${local.app_ns}",job="${local.api_name}"}[5m])) > 0.05
              for: 5m
              labels:
                severity: critical
                workload: api
              annotations:
                summary: 'More than 2% of api responses are 5xx'
                description: 'The 5xx ratio over 5 minutes is {{ $value | humanizePercentage }}. Check deployment/api logs and the Loki error stream, then rollout undo if the last rollout caused it.'
            - alert: ApiPodsHighLatencyP95
              expr: |
                histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{namespace="${local.app_ns}",job="${local.api_name}"}[5m]))) > 1
                and sum(rate(http_request_duration_seconds_count{namespace="${local.app_ns}",job="${local.api_name}"}[5m])) > 0.05
              for: 10m
              labels:
                severity: warning
                workload: api
              annotations:
                summary: 'api p95 latency above 1s'
                description: 'p95 is {{ $value | humanizeDuration }} over 5 minutes. Look at database latency, HPA headroom and CPU throttling.'
            - alert: ApiCpuSaturation
              expr: |
                sum(rate(container_cpu_usage_seconds_total{namespace="${local.app_ns}",container="${local.api_name}",pod=~"api-.*"}[5m]))
                  / sum(kube_pod_container_resource_requests{namespace="${local.app_ns}",container="${local.api_name}",resource="cpu"}) > 0.85
              for: 15m
              labels:
                severity: warning
                workload: api
              annotations:
                summary: 'api CPU above 85% of requests for 15 minutes'
                description: 'The HPA target is 85% of requests. If replicas are at maximum, raise the HPA maximum or the requests.'
            - alert: ApiMemorySaturation
              expr: |
                max by (pod) (container_memory_working_set_bytes{namespace="${local.app_ns}",container="${local.api_name}",pod=~"api-.*"})
                  / max by (pod) (kube_pod_container_resource_limits{namespace="${local.app_ns}",container="${local.api_name}",resource="memory"}) > 0.9
              for: 10m
              labels:
                severity: warning
                workload: api
              annotations:
                summary: 'api memory above 90% of the limit'
                description: 'Pod {{ $labels.pod }} is close to OOMKill. Check heap growth and the VPA recommendation for api.'
            - alert: ApiHpaAtMaxReplicas
              expr: |
                kube_horizontalpodautoscaler_status_current_replicas{namespace="${local.app_ns}",horizontalpodautoscaler="${local.api_name}"}
                  >= kube_horizontalpodautoscaler_spec_max_replicas{namespace="${local.app_ns}",horizontalpodautoscaler="${local.api_name}"}
              for: 15m
              labels:
                severity: warning
                workload: api
              annotations:
                summary: 'api HPA stuck at its maximum replicas'
                description: 'Capacity is exhausted at the configured maximum; scale limits need review.'
            - alert: ApiPodRestarts
              expr: increase(kube_pod_container_status_restarts_total{namespace="${local.app_ns}",container="${local.api_name}"}[30m]) > 2
              labels:
                severity: warning
                workload: api
              annotations:
                summary: 'api container restarted more than twice in 30 minutes'
                description: 'Pod {{ $labels.pod }} restarted {{ $value }} times. Check kubectl describe pod for OOMKilled or failing liveness.'
            - alert: ApiReadinessFailing
              expr: kube_deployment_status_replicas_unavailable{namespace="${local.app_ns}",deployment="${local.api_name}"} > 0
              for: 5m
              labels:
                severity: warning
                workload: api
              annotations:
                summary: 'api has unavailable replicas for 5 minutes'
                description: '/health/ready fails on {{ $value }} replica(s): database, Vault configuration cache or the PKI certificate.'
            - alert: ApiNoAvailableReplicas
              expr: kube_deployment_status_replicas_available{namespace="${local.app_ns}",deployment="${local.api_name}"} == 0
              for: 2m
              labels:
                severity: critical
                workload: api
              annotations:
                summary: 'api has no ready replica'
                description: 'The API is down. Check wait-vault init logs (sealed Vault), the migration Job and database readiness.'
            - alert: ApiMetricsTargetDown
              expr: up{namespace="${local.app_ns}",job="${local.api_name}"} == 0
              for: 5m
              labels:
                severity: warning
                workload: api
              annotations:
                summary: 'Prometheus cannot scrape api /metrics'
                description: 'Target {{ $labels.pod }} is down or the bearer token in Secret ${var.api_metrics_token_secret.name} does not match METRICS_TOKEN.'
  YAML

  web_rules_manifest = <<-YAML
    apiVersion: monitoring.coreos.com/v1
    kind: PrometheusRule
    metadata:
      name: time-manager-web
      namespace: ${local.app_ns}
      labels:
        release: ${var.prometheus_release_label}
        ${indent(4, yamlencode(local.workload_labels.web))}
    spec:
      groups:
        - name: time-manager-web-workload
          rules:
            - alert: WebHighErrorRate
              expr: |
                sum(rate(response_total{namespace="${local.app_ns}",deployment="${local.web_name}",direction="inbound",classification="failure"}[5m]))
                  / sum(rate(response_total{namespace="${local.app_ns}",deployment="${local.web_name}",direction="inbound"}[5m])) > 0.05
                and sum(rate(response_total{namespace="${local.app_ns}",deployment="${local.web_name}",direction="inbound"}[5m])) > 0.05
              for: 5m
              labels:
                severity: warning
                workload: web
              annotations:
                summary: 'More than 5% of web responses fail'
                description: 'Measured by the Linkerd proxy; nginx also fails when the api upstream is unreachable.'
            - alert: WebHighLatencyP95
              expr: |
                histogram_quantile(0.95, sum by (le) (rate(response_latency_ms_bucket{namespace="${local.app_ns}",deployment="${local.web_name}",direction="inbound"}[5m]))) > 1500
              for: 10m
              labels:
                severity: warning
                workload: web
              annotations:
                summary: 'web p95 latency above 1.5s'
                description: 'p95 is {{ $value }} ms over 5 minutes.'
            - alert: WebCpuSaturation
              expr: |
                sum(rate(container_cpu_usage_seconds_total{namespace="${local.app_ns}",container="${local.web_name}",pod=~"web-.*"}[5m]))
                  / sum(kube_pod_container_resource_requests{namespace="${local.app_ns}",container="${local.web_name}",resource="cpu"}) > 0.85
              for: 15m
              labels:
                severity: warning
                workload: web
              annotations:
                summary: 'web CPU above 85% of requests for 15 minutes'
                description: 'The HPA target is 85% of requests.'
            - alert: WebPodRestarts
              expr: increase(kube_pod_container_status_restarts_total{namespace="${local.app_ns}",container="${local.web_name}"}[30m]) > 2
              labels:
                severity: warning
                workload: web
              annotations:
                summary: 'web container restarted more than twice in 30 minutes'
                description: 'Pod {{ $labels.pod }} restarted {{ $value }} times.'
            - alert: WebReadinessFailing
              expr: kube_deployment_status_replicas_unavailable{namespace="${local.app_ns}",deployment="${local.web_name}"} > 0
              for: 5m
              labels:
                severity: warning
                workload: web
              annotations:
                summary: 'web has unavailable replicas for 5 minutes'
                description: '/healthz fails on {{ $value }} replica(s).'
            - alert: WebNoAvailableReplicas
              expr: kube_deployment_status_replicas_available{namespace="${local.app_ns}",deployment="${local.web_name}"} == 0
              for: 2m
              labels:
                severity: critical
                workload: web
              annotations:
                summary: 'web has no ready replica'
                description: 'The site is down.'
  YAML
}

resource "kubectl_manifest" "api_service_monitor" {
  yaml_body = local.api_service_monitor_manifest

  depends_on = [
    kubectl_manifest.service,
    kubernetes_namespace_v1.this,
    helm_release.kube_prometheus_stack,
  ]
}

resource "kubectl_manifest" "api_rules" {
  yaml_body = local.api_rules_manifest

  depends_on = [
    kubernetes_namespace_v1.this,
    helm_release.kube_prometheus_stack,
  ]
}

resource "kubectl_manifest" "web_rules" {
  yaml_body = local.web_rules_manifest

  depends_on = [
    kubernetes_namespace_v1.this,
    helm_release.kube_prometheus_stack,
  ]
}

locals {
  peer_namespace = { for k, v in {
    traefik    = local.ns.traefik
    monitoring = local.ns.monitoring
    databases  = local.ns.databases
    vault      = local.ns.vault
    system     = "kube-system"
  } : k => { "kubernetes.io/metadata.name" = v } }

  app_tcp = { for p in [53, 4143, 4191, 4318, 5432, 8000, 8080, 8200, 443] : tostring(p) => { port = p, protocol = "TCP" } }

  netpol_api_egress = merge(
    {
      "allow-api-to-postgres" = {
        peers = [{ ns = "databases", pods = var.postgres_pod_labels }]
        ports = [local.app_tcp["5432"]]
      }
      "allow-api-to-vault" = {
        peers = [{ ns = "vault", pods = var.vault_pod_labels }]
        ports = [local.app_tcp["8200"]]
      }
      "allow-api-to-alloy" = {
        peers = [{ ns = "monitoring", pods = var.alloy_pod_labels }]
        ports = [local.app_tcp["4318"], local.app_tcp["4143"]]
      }
      "allow-api-to-dns" = {
        peers = [{ ns = "system", pods = { "k8s-app" = "kube-dns" } }]
        ports = [{ port = 53, protocol = "UDP" }, local.app_tcp["53"]]
      }
    },
  )

  app_network_policies = merge(
    {
      "allow-traefik-to-web" = {
        podSelector = { matchLabels = local.workload_selector.web }
        policyTypes = ["Ingress"]
        ingress = [{
          from  = [{ namespaceSelector = { matchLabels = local.peer_namespace.traefik }, podSelector = { matchLabels = var.traefik_pod_labels } }]
          ports = [local.app_tcp["8080"]]
        }]
      }
      "allow-web-to-api" = {
        podSelector = { matchLabels = local.workload_selector.api }
        policyTypes = ["Ingress"]
        ingress = [{
          from  = [{ podSelector = { matchLabels = local.workload_selector.web } }]
          ports = [local.app_tcp["8000"], local.app_tcp["4143"]]
        }]
      }
      "allow-web-egress-to-api" = {
        podSelector = { matchLabels = local.workload_selector.web }
        policyTypes = ["Egress"]
        egress = [{
          to    = [{ podSelector = { matchLabels = local.workload_selector.api } }]
          ports = [local.app_tcp["8000"], local.app_tcp["4143"]]
        }]
      }
      "allow-alloy-to-workloads" = {
        podSelector = { matchExpressions = [{ key = "app", operator = "In", values = [local.api_name, local.web_name] }] }
        policyTypes = ["Ingress"]
        ingress = [{
          from  = [{ namespaceSelector = { matchLabels = local.peer_namespace.monitoring }, podSelector = { matchLabels = var.alloy_pod_labels } }]
          ports = [local.app_tcp["8000"], local.app_tcp["8080"], local.app_tcp["4143"]]
        }]
      }
      "allow-monitoring-to-api" = {
        podSelector = { matchLabels = local.workload_selector.api }
        policyTypes = ["Ingress"]
        ingress = [{
          from  = [{ namespaceSelector = { matchLabels = local.peer_namespace.monitoring }, podSelector = { matchLabels = var.prometheus_pod_labels } }]
          ports = [local.app_tcp["8000"], local.app_tcp["4143"], local.app_tcp["4191"]]
        }]
      }
    },
    var.expose_api_publicly ? {
      "allow-traefik-to-api" = {
        podSelector = { matchLabels = local.workload_selector.api }
        policyTypes = ["Ingress"]
        ingress = [{
          from  = [{ namespaceSelector = { matchLabels = local.peer_namespace.traefik }, podSelector = { matchLabels = var.traefik_pod_labels } }]
          ports = [local.app_tcp["8000"]]
        }]
      }
    } : {},
    { for name, rule in local.netpol_api_egress : name => {
      podSelector = { matchLabels = { app = local.api_name } }
      policyTypes = ["Egress"]
      egress = [{
        to    = [for peer in rule.peers : { namespaceSelector = { matchLabels = local.peer_namespace[peer.ns] }, podSelector = { matchLabels = peer.pods } }]
        ports = rule.ports
      }]
    } },
    try(var.features.microsoft_egress, false) ? {
      "allow-api-egress-microsoft" = {
        podSelector = { matchLabels = local.workload_selector.api }
        policyTypes = ["Egress"]
        egress = [{
          to    = [for cidr in var.microsoft_egress_cidrs : { ipBlock = { cidr = cidr, except = var.microsoft_egress_except_cidrs } }]
          ports = [local.app_tcp["443"]]
        }]
      }
    } : {},
  )

  app_network_policy_manifests = { for name, spec in local.app_network_policies : name => yamlencode({
    apiVersion = "networking.k8s.io/v1"
    kind       = "NetworkPolicy"
    metadata = {
      name      = name
      namespace = local.app_ns
      labels    = local.common_labels
    }
    spec = spec
  }) }
}

resource "kubectl_manifest" "app_network_policy" {
  for_each = local.app_network_policy_manifests

  yaml_body = each.value

  depends_on = [
    kubernetes_namespace_v1.this,
  ]
}

locals {
  public_certificate_manifests = { for k, host in local.public_hosts : k => <<-YAML
    apiVersion: cert-manager.io/v1
    kind: Certificate
    metadata:
      name: ${k}-public
      namespace: ${local.app_ns}
      labels:
        ${indent(4, yamlencode(local.workload_labels[k]))}
    spec:
      secretName: ${k}-public-tls
      dnsNames:
        - ${host}
      issuerRef:
        name: ${local.public_issuer}
        kind: ClusterIssuer
        group: cert-manager.io
      privateKey:
        algorithm: ECDSA
        size: 256
        rotationPolicy: Always
      renewBefore: 720h
  YAML
  }

  api_servers_transport_manifest = <<-YAML
    apiVersion: traefik.io/v1alpha1
    kind: ServersTransport
    metadata:
      name: api-internal-ca
      namespace: ${local.app_ns}
      labels:
        ${indent(4, yamlencode(local.workload_labels.api))}
    spec:
      serverName: ${local.api_service_dns}
      insecureSkipVerify: false
      rootCAsSecrets:
        - ${local.ca_bundle_secret}
      maxIdleConnsPerHost: 50
      forwardingTimeouts:
        dialTimeout: 5s
        responseHeaderTimeout: 60s
        idleConnTimeout: 90s
  YAML

  ingress_route_manifests = { for k, host in local.public_hosts : k => <<-YAML
    apiVersion: traefik.io/v1alpha1
    kind: IngressRoute
    metadata:
      name: ${k}
      namespace: ${local.app_ns}
      labels:
        ${indent(4, yamlencode(local.workload_labels[k]))}
    spec:
      entryPoints:
        - websecure
      routes:
        - kind: Rule
          match: Host(`${host}`)
          middlewares:
            - name: default-chain
              namespace: ${local.ns.traefik}
          services:
            - name: ${local.workloads[k].name}
              port: ${local.workloads[k].service_port}
              scheme: ${k == "api" && var.api_tls_enabled ? "https" : "http"}
              passHostHeader: true
              ${k == "api" && var.api_tls_enabled ? "serversTransport: api-internal-ca" : ""}
      tls:
        secretName: ${k}-public-tls
        options:
          name: ${local.tls_option_name}
          namespace: ${local.ns.traefik}
  YAML
  }
}

resource "kubectl_manifest" "public_certificate" {
  for_each = local.public_certificate_manifests

  yaml_body = each.value

  depends_on = [
    kubernetes_namespace_v1.this,
    kubectl_manifest.letsencrypt_issuer,
    kubectl_manifest.bootstrap_ca_issuer,
  ]
}

resource "kubectl_manifest" "api_servers_transport" {
  for_each = var.api_tls_enabled && var.expose_api_publicly ? { api = local.api_servers_transport_manifest } : {}

  yaml_body = each.value

  depends_on = [
    kubernetes_secret_v1.ca_bundle["app"],
    kubernetes_namespace_v1.this,
    helm_release.traefik,
  ]
}

resource "kubectl_manifest" "ingress_route" {
  for_each = local.ingress_route_manifests

  yaml_body = each.value

  depends_on = [
    kubectl_manifest.service,
    kubectl_manifest.public_certificate,
    kubectl_manifest.api_servers_transport,
    kubectl_manifest.app_network_policy,
    kubectl_manifest.traefik_chains,
    kubectl_manifest.traefik_tls_option,
  ]
}
