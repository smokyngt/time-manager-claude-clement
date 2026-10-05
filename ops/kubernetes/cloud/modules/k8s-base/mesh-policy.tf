locals {
  mesh_namespaces = sort([for ns, c in local.namespace_config : ns if c.mesh])

  linkerd_control_plane_ports = [
    { port = 8080, protocol = "TCP" },
    { port = 8086, protocol = "TCP" },
    { port = 8090, protocol = "TCP" },
  ]

  mesh_servers = {
    api = {
      selector = local.workload_selector.api
      port     = "api"
      protocol = var.api_tls_enabled ? "TLS" : "HTTP/1"
    }
    web = {
      selector = local.workload_selector.web
      port     = "http"
      protocol = "HTTP/1"
    }
  }

  mesh_server_manifests = { for k, s in local.mesh_servers : k => <<-YAML
    apiVersion: policy.linkerd.io/v1beta3
    kind: Server
    metadata:
      name: ${k}
      namespace: ${local.app_ns}
      labels:
        ${indent(4, yamlencode(local.workload_labels[k]))}
    spec:
      podSelector:
        matchLabels:
          ${indent(6, yamlencode(s.selector))}
      port: ${s.port}
      proxyProtocol: ${s.protocol}
  YAML
  }

  mesh_authentication_manifests = {
    "mtls-web"        = <<-YAML
      apiVersion: policy.linkerd.io/v1alpha1
      kind: MeshTLSAuthentication
      metadata:
        name: web
        namespace: ${local.app_ns}
        labels:
          ${indent(4, yamlencode(local.common_labels))}
      spec:
        identityRefs:
          - kind: ServiceAccount
            name: ${local.web_name}
            namespace: ${local.app_ns}
    YAML
    "mtls-prometheus" = <<-YAML
      apiVersion: policy.linkerd.io/v1alpha1
      kind: MeshTLSAuthentication
      metadata:
        name: prometheus
        namespace: ${local.app_ns}
        labels:
          ${indent(4, yamlencode(local.common_labels))}
      spec:
        identityRefs:
          - kind: ServiceAccount
            name: ${var.prometheus_service_account}
            namespace: ${local.ns.monitoring}
    YAML
    "mtls-alloy"      = <<-YAML
      apiVersion: policy.linkerd.io/v1alpha1
      kind: MeshTLSAuthentication
      metadata:
        name: alloy
        namespace: ${local.app_ns}
        labels:
          ${indent(4, yamlencode(local.common_labels))}
      spec:
        identityRefs:
          - kind: ServiceAccount
            name: alloy
            namespace: ${local.ns.monitoring}
    YAML
    "network-traefik" = <<-YAML
      apiVersion: policy.linkerd.io/v1alpha1
      kind: NetworkAuthentication
      metadata:
        name: traefik-ingress
        namespace: ${local.app_ns}
        labels:
          ${indent(4, yamlencode(local.common_labels))}
      spec:
        networks:
          ${indent(4, yamlencode([for c in var.ingress_source_cidrs : { cidr = c }]))}
    YAML
    "network-kubelet" = <<-YAML
      apiVersion: policy.linkerd.io/v1alpha1
      kind: NetworkAuthentication
      metadata:
        name: kubelet-probes
        namespace: ${local.app_ns}
        labels:
          ${indent(4, yamlencode(local.common_labels))}
      spec:
        networks:
          ${indent(4, yamlencode([for c in var.kubelet_probe_cidrs : { cidr = c }]))}
    YAML
  }

  mesh_authorization = merge(
    {
      "web-from-traefik" = { server = "web", authn = [{ kind = "NetworkAuthentication", name = "traefik-ingress" }] }
      "web-probes"       = { server = "web", authn = [{ kind = "NetworkAuthentication", name = "kubelet-probes" }] }
      "api-from-web"     = { server = "api", authn = [{ kind = "MeshTLSAuthentication", name = "web" }] }
      "api-from-prom"    = { server = "api", authn = [{ kind = "MeshTLSAuthentication", name = "prometheus" }] }
      "api-from-alloy"   = { server = "api", authn = [{ kind = "MeshTLSAuthentication", name = "alloy" }] }
      "web-from-alloy"   = { server = "web", authn = [{ kind = "MeshTLSAuthentication", name = "alloy" }] }
      "api-probes"       = { server = "api", authn = [{ kind = "NetworkAuthentication", name = "kubelet-probes" }] }
    },
    { for k, v in { "api-from-traefik" = { server = "api", authn = [{ kind = "NetworkAuthentication", name = "traefik-ingress" }] } } : k => v if var.expose_api_publicly },
  )

  mesh_authorization_manifests = { for name, a in local.mesh_authorization : name => <<-YAML
    apiVersion: policy.linkerd.io/v1alpha1
    kind: AuthorizationPolicy
    metadata:
      name: ${name}
      namespace: ${local.app_ns}
      labels:
        ${indent(4, yamlencode(local.common_labels))}
    spec:
      targetRef:
        group: policy.linkerd.io
        kind: Server
        name: ${a.server}
      requiredAuthenticationRefs:
        ${indent(4, yamlencode([for r in a.authn : { group = "policy.linkerd.io", kind = r.kind, name = r.name }]))}
  YAML
  }

  mesh_network_policies = merge(
    { for ns in local.mesh_namespaces : "${ns}/allow-mesh-control-plane-egress" => {
      namespace = ns
      name      = "allow-mesh-control-plane-egress"
      spec = {
        podSelector = {}
        policyTypes = ["Egress"]
        egress = [{
          to    = [{ namespaceSelector = { matchLabels = { "kubernetes.io/metadata.name" = local.linkerd_ns } } }]
          ports = local.linkerd_control_plane_ports
        }]
      }
    } },
    { for ns in local.mesh_namespaces : "${ns}/allow-mesh-proxy-ingress" => {
      namespace = ns
      name      = "allow-mesh-proxy-ingress"
      spec = {
        podSelector = {}
        policyTypes = ["Ingress"]
        ingress = [{
          from  = [for peer in local.mesh_namespaces : { namespaceSelector = { matchLabels = { "kubernetes.io/metadata.name" = peer } } }]
          ports = [{ port = local.mesh_proxy_in, protocol = "TCP" }]
        }]
      }
    } },
    { for ns in local.mesh_namespaces : "${ns}/allow-mesh-proxy-egress" => {
      namespace = ns
      name      = "allow-mesh-proxy-egress"
      spec = {
        podSelector = {}
        policyTypes = ["Egress"]
        egress = [{
          to    = [for peer in local.mesh_namespaces : { namespaceSelector = { matchLabels = { "kubernetes.io/metadata.name" = peer } } }]
          ports = [{ port = local.mesh_proxy_in, protocol = "TCP" }]
        }]
      }
    } },
    { for ns in local.mesh_namespaces : "${ns}/allow-monitoring-to-linkerd-admin" => {
      namespace = ns
      name      = "allow-monitoring-to-linkerd-admin"
      spec = {
        podSelector = {}
        policyTypes = ["Ingress"]
        ingress = [{
          from  = [{ namespaceSelector = { matchLabels = { "kubernetes.io/metadata.name" = local.ns.monitoring } }, podSelector = { matchLabels = var.prometheus_pod_labels } }]
          ports = [{ port = local.mesh_admin_in, protocol = "TCP" }]
        }]
      }
    } },
    {
      "${local.linkerd_ns}/allow-mesh-to-linkerd-control-plane" = {
        namespace = local.linkerd_ns
        name      = "allow-mesh-to-linkerd-control-plane"
        spec = {
          podSelector = {}
          policyTypes = ["Ingress"]
          ingress = [{
            from  = [for ns in local.mesh_namespaces : { namespaceSelector = { matchLabels = { "kubernetes.io/metadata.name" = ns } } }]
            ports = local.linkerd_control_plane_ports
          }]
        }
      }
      "${local.linkerd_ns}/allow-linkerd-intra" = {
        namespace = local.linkerd_ns
        name      = "allow-linkerd-intra"
        spec = {
          podSelector = {}
          policyTypes = ["Ingress", "Egress"]
          ingress     = [{ from = [{ podSelector = {} }] }]
          egress      = [{ to = [{ podSelector = {} }] }]
        }
      }
      "${local.linkerd_ns}/allow-apiserver-to-linkerd-webhooks" = {
        namespace = local.linkerd_ns
        name      = "allow-apiserver-to-linkerd-webhooks"
        spec = {
          podSelector = {}
          policyTypes = ["Ingress"]
          ingress = [{
            from  = [for c in var.kube_api_cidrs : { ipBlock = { cidr = c } }]
            ports = [{ port = 8443, protocol = "TCP" }, { port = 9443, protocol = "TCP" }]
          }]
        }
      }
      "${local.linkerd_ns}/allow-linkerd-to-kube-api" = {
        namespace = local.linkerd_ns
        name      = "allow-linkerd-to-kube-api"
        spec = {
          podSelector = {}
          policyTypes = ["Egress"]
          egress = [{
            to    = [for c in var.kube_api_cidrs : { ipBlock = { cidr = c } }]
            ports = [for p in var.kube_api_ports : { port = p, protocol = "TCP" }]
          }]
        }
      }
    },
  )

  mesh_network_policy_manifests = { for key, np in local.mesh_network_policies : key => yamlencode({
    apiVersion = "networking.k8s.io/v1"
    kind       = "NetworkPolicy"
    metadata = {
      name      = np.name
      namespace = np.namespace
      labels    = local.common_labels
    }
    spec = np.spec
  }) }
}

resource "kubectl_manifest" "mesh_server" {
  for_each = local.mesh_server_manifests

  yaml_body = each.value

  depends_on = [helm_release.linkerd_crds, kubernetes_namespace_v1.this]
}

resource "kubectl_manifest" "mesh_authentication" {
  for_each = local.mesh_authentication_manifests

  yaml_body = each.value

  depends_on = [helm_release.linkerd_crds, kubernetes_namespace_v1.this]
}

resource "kubectl_manifest" "mesh_authorization" {
  for_each = local.mesh_authorization_manifests

  yaml_body = each.value

  depends_on = [kubectl_manifest.mesh_server, kubectl_manifest.mesh_authentication]
}

resource "kubectl_manifest" "mesh_network_policy" {
  for_each = local.mesh_network_policy_manifests

  yaml_body = each.value

  depends_on = [kubernetes_namespace_v1.this]
}
