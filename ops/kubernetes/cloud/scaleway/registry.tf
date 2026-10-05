resource "scaleway_registry_namespace" "this" {
  name        = "${var.registry_namespace}-${var.tenant}"
  description = "Time Manager images for ${var.tenant}"
  is_public   = false
  region      = var.region
  project_id  = var.project_id
}

resource "scaleway_iam_application" "registry_pull" {
  name        = "${var.cluster_name}-${var.tenant}-registry-pull"
  description = "Pulls Time Manager images into the cluster"
}

resource "scaleway_iam_policy" "registry_pull" {
  name           = "${var.cluster_name}-${var.tenant}-registry-pull"
  application_id = scaleway_iam_application.registry_pull.id

  rule {
    project_ids          = [var.project_id]
    permission_set_names = ["ContainerRegistryReadOnly"]
  }
}

resource "scaleway_iam_api_key" "registry_pull" {
  application_id     = scaleway_iam_application.registry_pull.id
  description        = "Image pull secret of ${var.cluster_name}-${var.tenant}"
  default_project_id = var.project_id
}

locals {
  registry_server = split("/", scaleway_registry_namespace.this.endpoint)[0]
}
