locals {
  linkerd_ns         = local.ns.linkerd
  linkerd_cni_ns     = local.ns.linkerd_cni
  linkerd_repository = "https://helm.linkerd.io/edge"

  linkerd_webhooks = {
    "linkerd-proxy-injector" = {
      service = "linkerd-proxy-injector"
      secret  = "linkerd-proxy-injector-k8s-tls"
    }
    "linkerd-sp-validator" = {
      service = "linkerd-sp-validator"
      secret  = "linkerd-sp-validator-k8s-tls"
    }
    "linkerd-policy-validator" = {
      service = "linkerd-policy-validator"
      secret  = "linkerd-policy-validator-k8s-tls"
    }
  }

  linkerd_control_plane_values = merge(
    {
      installNamespace          = false
      cniEnabled                = true
      identityTrustAnchorsPEM   = vault_pki_secret_backend_root_sign_intermediate.linkerd_trust_anchor.certificate
      controllerReplicas        = var.linkerd_controller_replicas
      enablePodAntiAffinity     = var.linkerd_controller_replicas > 1
      enablePodDisruptionBudget = var.linkerd_controller_replicas > 1
      identity = {
        issuer = {
          scheme = "kubernetes.io/tls"
        }
      }
      proxyInjector    = { externalSecret = true, injectCaFrom = "${local.linkerd_ns}/linkerd-proxy-injector" }
      profileValidator = { externalSecret = true, injectCaFrom = "${local.linkerd_ns}/linkerd-sp-validator" }
      policyValidator  = { externalSecret = true, injectCaFrom = "${local.linkerd_ns}/linkerd-policy-validator" }
      proxy = {
        resources = {
          cpu    = { request = var.linkerd_proxy_resources.cpu_request }
          memory = { request = var.linkerd_proxy_resources.memory_request, limit = var.linkerd_proxy_resources.memory_limit }
        }
      }
    },
    var.linkerd_control_plane_values,
  )

  linkerd_pod_monitor_relabelings = [
    { sourceLabels = ["__meta_kubernetes_pod_container_port_name"], action = "keep", regex = "linkerd-admin" },
    { action = "labelmap", regex = "__meta_kubernetes_pod_label_linkerd_io_proxy_(.+)" },
    { sourceLabels = ["__meta_kubernetes_pod_container_name"], action = "replace", targetLabel = "container" },
  ]
}

resource "tls_private_key" "linkerd_trust_anchor" {
  algorithm   = "ECDSA"
  ecdsa_curve = "P256"
}

resource "tls_cert_request" "linkerd_trust_anchor" {
  private_key_pem = tls_private_key.linkerd_trust_anchor.private_key_pem

  subject {
    common_name = "root.linkerd.cluster.local"
  }
}

resource "vault_pki_secret_backend_root_sign_intermediate" "linkerd_trust_anchor" {
  backend              = vault_mount.pki_root.path
  csr                  = tls_cert_request.linkerd_trust_anchor.cert_request_pem
  common_name          = "root.linkerd.cluster.local"
  ttl                  = var.linkerd_trust_anchor_ttl
  format               = "pem"
  max_path_length      = 1
  exclude_cn_from_sans = true

  depends_on = [vault_pki_secret_backend_root_cert.root]
}

resource "kubernetes_labels" "linkerd_namespace" {
  api_version = "v1"
  kind        = "Namespace"

  metadata {
    name = local.linkerd_ns
  }

  labels = {
    "linkerd.io/is-control-plane"          = "true"
    "config.linkerd.io/admission-webhooks" = "disabled"
    "linkerd.io/control-plane-ns"          = local.linkerd_ns
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_secret_v1" "linkerd_trust_anchor" {
  metadata {
    name      = "linkerd-trust-anchor"
    namespace = local.linkerd_ns
    labels    = local.common_labels
  }

  type = "kubernetes.io/tls"

  data = {
    "tls.crt" = vault_pki_secret_backend_root_sign_intermediate.linkerd_trust_anchor.certificate
    "tls.key" = tls_private_key.linkerd_trust_anchor.private_key_pem
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "helm_release" "linkerd_cni" {
  name       = "linkerd-cni"
  repository = local.linkerd_repository
  chart      = "linkerd2-cni"
  version    = local.chart_versions["linkerd-cni"]
  namespace  = local.linkerd_cni_ns

  wait            = true
  timeout         = 600
  atomic          = true
  cleanup_on_fail = true

  values = [yamlencode(merge({ installNamespace = false }, var.linkerd_cni_values))]

  depends_on = [kubernetes_namespace_v1.this]
}

resource "helm_release" "linkerd_crds" {
  name       = "linkerd-crds"
  repository = local.linkerd_repository
  chart      = "linkerd-crds"
  version    = local.chart_versions["linkerd-crds"]
  namespace  = local.linkerd_ns

  wait            = true
  timeout         = 600
  atomic          = true
  cleanup_on_fail = true

  values = [yamlencode({ installGatewayAPI = false })]

  depends_on = [kubernetes_namespace_v1.this]
}

locals {
  linkerd_trust_anchor_issuer_manifest = <<-YAML
    apiVersion: cert-manager.io/v1
    kind: Issuer
    metadata:
      name: linkerd-trust-anchor
      namespace: ${local.linkerd_ns}
      labels:
        ${indent(4, yamlencode(local.common_labels))}
    spec:
      ca:
        secretName: ${kubernetes_secret_v1.linkerd_trust_anchor.metadata[0].name}
  YAML

  linkerd_identity_issuer_manifest = <<-YAML
    apiVersion: cert-manager.io/v1
    kind: Certificate
    metadata:
      name: linkerd-identity-issuer
      namespace: ${local.linkerd_ns}
      labels:
        ${indent(4, yamlencode(local.common_labels))}
    spec:
      secretName: linkerd-identity-issuer
      duration: ${var.linkerd_identity_issuer.duration}
      renewBefore: ${var.linkerd_identity_issuer.renew_before}
      issuerRef:
        name: linkerd-trust-anchor
        kind: Issuer
        group: cert-manager.io
      commonName: identity.${local.linkerd_ns}.cluster.local
      dnsNames:
        - identity.${local.linkerd_ns}.cluster.local
      isCA: true
      privateKey:
        algorithm: ECDSA
        size: 256
        rotationPolicy: Always
      usages:
        - cert sign
        - crl sign
        - server auth
        - client auth
  YAML

  linkerd_webhook_selfsigned_manifest = <<-YAML
    apiVersion: cert-manager.io/v1
    kind: Issuer
    metadata:
      name: linkerd-webhook-selfsigned
      namespace: ${local.linkerd_ns}
      labels:
        ${indent(4, yamlencode(local.common_labels))}
    spec:
      selfSigned: {}
  YAML

  linkerd_webhook_ca_manifest = <<-YAML
    apiVersion: cert-manager.io/v1
    kind: Certificate
    metadata:
      name: linkerd-webhook-ca
      namespace: ${local.linkerd_ns}
      labels:
        ${indent(4, yamlencode(local.common_labels))}
    spec:
      isCA: true
      commonName: linkerd-webhook-ca
      secretName: linkerd-webhook-ca
      duration: 43800h
      renewBefore: 8760h
      privateKey:
        algorithm: ECDSA
        size: 256
      issuerRef:
        name: linkerd-webhook-selfsigned
        kind: Issuer
        group: cert-manager.io
  YAML

  linkerd_webhook_issuer_manifest = <<-YAML
    apiVersion: cert-manager.io/v1
    kind: Issuer
    metadata:
      name: linkerd-webhook-issuer
      namespace: ${local.linkerd_ns}
      labels:
        ${indent(4, yamlencode(local.common_labels))}
    spec:
      ca:
        secretName: linkerd-webhook-ca
  YAML

  linkerd_webhook_certificate_manifests = { for name, w in local.linkerd_webhooks : name => <<-YAML
    apiVersion: cert-manager.io/v1
    kind: Certificate
    metadata:
      name: ${name}
      namespace: ${local.linkerd_ns}
      labels:
        ${indent(4, yamlencode(local.common_labels))}
    spec:
      secretName: ${w.secret}
      duration: 24h
      renewBefore: 8h
      issuerRef:
        name: linkerd-webhook-issuer
        kind: Issuer
        group: cert-manager.io
      commonName: ${w.service}.${local.linkerd_ns}.svc
      dnsNames:
        - ${w.service}.${local.linkerd_ns}.svc
      privateKey:
        algorithm: ECDSA
        size: 256
        rotationPolicy: Always
      usages:
        - server auth
  YAML
  }

  linkerd_proxy_pod_monitor_manifest = <<-YAML
    apiVersion: monitoring.coreos.com/v1
    kind: PodMonitor
    metadata:
      name: linkerd-proxy
      namespace: ${local.ns.monitoring}
      labels:
        release: ${var.prometheus_release_label}
        ${indent(4, yamlencode(local.common_labels))}
    spec:
      namespaceSelector:
        any: true
      selector:
        matchExpressions:
          - key: linkerd.io/control-plane-ns
            operator: Exists
      podMetricsEndpoints:
        - path: /metrics
          interval: 30s
          scrapeTimeout: 10s
          relabelings:
            ${indent(8, yamlencode(local.linkerd_pod_monitor_relabelings))}
  YAML

  linkerd_control_plane_pod_monitor_manifest = <<-YAML
    apiVersion: monitoring.coreos.com/v1
    kind: PodMonitor
    metadata:
      name: linkerd-control-plane
      namespace: ${local.ns.monitoring}
      labels:
        release: ${var.prometheus_release_label}
        ${indent(4, yamlencode(local.common_labels))}
    spec:
      namespaceSelector:
        matchNames:
          - ${local.linkerd_ns}
      selector:
        matchExpressions:
          - key: linkerd.io/control-plane-component
            operator: Exists
      podMetricsEndpoints:
        - path: /metrics
          interval: 30s
          scrapeTimeout: 10s
          relabelings:
            - sourceLabels: [__meta_kubernetes_pod_container_port_name]
              action: keep
              regex: admin-http
            - sourceLabels: [__meta_kubernetes_pod_container_name]
              action: replace
              targetLabel: component
  YAML

  linkerd_rules_manifest = <<-YAML
    apiVersion: monitoring.coreos.com/v1
    kind: PrometheusRule
    metadata:
      name: linkerd-mesh
      namespace: ${local.ns.monitoring}
      labels:
        release: ${var.prometheus_release_label}
        ${indent(4, yamlencode(local.common_labels))}
    spec:
      groups:
        - name: linkerd-identity
          rules:
            - alert: LinkerdIdentityIssuerExpiring
              expr: certmanager_certificate_expiration_timestamp_seconds{name="linkerd-identity-issuer"} - time() < 12 * 3600
              for: 10m
              labels:
                severity: critical
              annotations:
                summary: 'Linkerd identity issuer certificate expires in less than 12 hours'
                description: 'cert-manager did not renew linkerd-identity-issuer (renewal starts 25 hours before expiry). Check kubectl -n ${local.linkerd_ns} describe certificate linkerd-identity-issuer and the Issuer linkerd-trust-anchor.'
            - alert: LinkerdIdentityIssuerNotReady
              expr: certmanager_certificate_ready_status{name="linkerd-identity-issuer",condition="True"} == 0
              for: 10m
              labels:
                severity: critical
              annotations:
                summary: 'Linkerd identity issuer certificate is not ready'
                description: 'Without a valid issuer no new proxy can obtain an identity and meshed pods fail to start.'
            - alert: LinkerdProxyIdentityExpiring
              expr: min by (namespace, pod) (identity_cert_expiration_timestamp_seconds) - time() < 4 * 3600
              for: 15m
              labels:
                severity: warning
              annotations:
                summary: 'A proxy identity certificate expires in less than 4 hours'
                description: 'Pod {{ $labels.namespace }}/{{ $labels.pod }} cannot renew its mesh identity (identity service unreachable or issuer expired).'
        - name: linkerd-control-plane
          rules:
            - alert: LinkerdControlPlaneDown
              expr: kube_deployment_status_replicas_available{namespace="${local.linkerd_ns}",deployment=~"linkerd-(identity|destination|proxy-injector)"} == 0
              for: 5m
              labels:
                severity: critical
              annotations:
                summary: 'Linkerd control plane component has no ready replica'
                description: 'Deployment {{ $labels.deployment }} is down; new meshed pods cannot start and policy changes do not apply.'
            - alert: LinkerdControlPlaneDegraded
              expr: kube_deployment_status_replicas_unavailable{namespace="${local.linkerd_ns}"} > 0
              for: 15m
              labels:
                severity: warning
              annotations:
                summary: 'Linkerd control plane has unavailable replicas'
                description: 'Deployment {{ $labels.deployment }} has {{ $value }} unavailable replica(s).'
            - alert: LinkerdProxyTargetsMissing
              expr: absent(identity_cert_expiration_timestamp_seconds)
              for: 15m
              labels:
                severity: warning
              annotations:
                summary: 'No Linkerd proxy metrics are scraped'
                description: 'The PodMonitor linkerd-proxy matches no target; mesh dashboards and alerts are blind.'
        - name: linkerd-traffic
          rules:
            - alert: LinkerdMeshedHighFailureRate
              expr: |
                sum by (namespace, deployment) (rate(response_total{direction="inbound",classification="failure"}[5m]))
                  / sum by (namespace, deployment) (rate(response_total{direction="inbound"}[5m])) > 0.05
                and sum by (namespace, deployment) (rate(response_total{direction="inbound"}[5m])) > 0.1
              for: 10m
              labels:
                severity: warning
              annotations:
                summary: 'More than 5% of inbound responses fail on a meshed workload'
                description: '{{ $labels.namespace }}/{{ $labels.deployment }} fails {{ $value | humanizePercentage }} of requests.'
            - alert: LinkerdAuthorizationDenied
              expr: sum by (namespace, deployment, authz_name, server_name) (rate(inbound_http_authz_deny_total[5m]) + rate(inbound_tcp_authz_deny_total[5m])) > 0
              for: 10m
              labels:
                severity: warning
              annotations:
                summary: 'Linkerd denies connections on a meshed workload'
                description: '{{ $labels.namespace }}/{{ $labels.deployment }} denies traffic by policy. A new client needs an AuthorizationPolicy, or a flow is being probed.'
  YAML
}

resource "kubectl_manifest" "linkerd_trust_anchor_issuer" {
  yaml_body = local.linkerd_trust_anchor_issuer_manifest

  depends_on = [helm_release.cert_manager, kubernetes_secret_v1.linkerd_trust_anchor]
}

resource "kubectl_manifest" "linkerd_identity_issuer" {
  yaml_body = local.linkerd_identity_issuer_manifest

  wait_for {
    condition {
      type   = "Ready"
      status = "True"
    }
  }

  depends_on = [kubectl_manifest.linkerd_trust_anchor_issuer]
}

resource "kubectl_manifest" "linkerd_webhook_selfsigned" {
  yaml_body = local.linkerd_webhook_selfsigned_manifest

  depends_on = [helm_release.cert_manager, kubernetes_namespace_v1.this]
}

resource "kubectl_manifest" "linkerd_webhook_ca" {
  yaml_body = local.linkerd_webhook_ca_manifest

  depends_on = [kubectl_manifest.linkerd_webhook_selfsigned]
}

resource "kubectl_manifest" "linkerd_webhook_issuer" {
  yaml_body = local.linkerd_webhook_issuer_manifest

  depends_on = [kubectl_manifest.linkerd_webhook_ca]
}

resource "kubectl_manifest" "linkerd_webhook_certificate" {
  for_each = local.linkerd_webhook_certificate_manifests

  yaml_body = each.value

  wait_for {
    condition {
      type   = "Ready"
      status = "True"
    }
  }

  depends_on = [kubectl_manifest.linkerd_webhook_issuer]
}

resource "helm_release" "linkerd_control_plane" {
  name       = "linkerd-control-plane"
  repository = local.linkerd_repository
  chart      = "linkerd-control-plane"
  version    = local.chart_versions["linkerd-control-plane"]
  namespace  = local.linkerd_ns

  wait            = true
  timeout         = 900
  atomic          = true
  cleanup_on_fail = true

  values = [yamlencode(local.linkerd_control_plane_values)]

  depends_on = [
    helm_release.linkerd_cni,
    helm_release.linkerd_crds,
    kubernetes_labels.linkerd_namespace,
    kubectl_manifest.linkerd_identity_issuer,
    kubectl_manifest.linkerd_webhook_certificate,
  ]
}

resource "kubectl_manifest" "linkerd_proxy_pod_monitor" {
  yaml_body = local.linkerd_proxy_pod_monitor_manifest

  depends_on = [helm_release.linkerd_control_plane]
}

resource "kubectl_manifest" "linkerd_control_plane_pod_monitor" {
  yaml_body = local.linkerd_control_plane_pod_monitor_manifest

  depends_on = [helm_release.linkerd_control_plane]
}

resource "kubectl_manifest" "linkerd_rules" {
  yaml_body = local.linkerd_rules_manifest

  depends_on = [helm_release.linkerd_control_plane]
}
