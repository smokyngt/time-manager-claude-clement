resource "kubernetes_storage_class_v1" "encrypted" {
  metadata {
    name   = "timemanager-sbs-encrypted"
    labels = { "app.kubernetes.io/managed-by" = "terraform" }
  }

  storage_provisioner    = "csi.scaleway.com"
  reclaim_policy         = "Delete"
  volume_binding_mode    = "WaitForFirstConsumer"
  allow_volume_expansion = true

  parameters = {
    type      = "sbs_${var.storage_iops}"
    encrypted = "true"
  }

  depends_on = [scaleway_k8s_pool.app]
}

resource "kubernetes_storage_class_v1" "encrypted_retain" {
  metadata {
    name   = "timemanager-sbs-encrypted-retain"
    labels = { "app.kubernetes.io/managed-by" = "terraform" }
  }

  storage_provisioner    = "csi.scaleway.com"
  reclaim_policy         = "Retain"
  volume_binding_mode    = "WaitForFirstConsumer"
  allow_volume_expansion = true

  parameters = {
    type      = "sbs_${var.storage_iops}"
    encrypted = "true"
  }

  depends_on = [scaleway_k8s_pool.app]
}
