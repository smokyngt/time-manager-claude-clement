resource "helm_release" "longhorn" {
  for_each = var.features.longhorn_backup ? toset(["longhorn"]) : toset([])

  name       = each.key
  repository = "https://charts.longhorn.io"
  chart      = "longhorn"
  version    = local.chart_versions["longhorn"]
  namespace  = kubernetes_namespace_v1.this[local.ns.longhorn].metadata[0].name

  wait    = true
  timeout = 900

  values = [yamlencode({
    defaultSettings = {
      defaultReplicaCount               = 2
      storageMinimalAvailablePercentage = 15
      nodeDownPodDeletionPolicy         = "delete-both-statefulset-and-deployment-pod"
    }
    persistence = {
      defaultClass             = false
      defaultClassReplicaCount = 2
    }
    longhornManager = {
      priorityClass = kubernetes_priority_class_v1.critical.metadata[0].name
    }
    longhornUI = {
      replicas = 1
    }
  })]

  depends_on = [kubernetes_priority_class_v1.critical]
}
