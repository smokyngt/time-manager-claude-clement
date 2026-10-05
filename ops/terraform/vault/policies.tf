locals {
  policies = toset(["app", "backup", "monitoring", "operator"])
}

resource "vault_policy" "this" {
  for_each = local.policies

  name   = each.key
  policy = file("${path.module}/../../vault/policies/${each.key}.hcl")
}
