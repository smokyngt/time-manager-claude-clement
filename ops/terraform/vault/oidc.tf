resource "vault_identity_oidc_key" "grafana" {
  count = var.grafana_oidc_enabled ? 1 : 0

  name               = "grafana"
  algorithm          = "RS256"
  allowed_client_ids = ["*"]
  rotation_period    = 86400
  verification_ttl   = 86400
}

resource "vault_identity_oidc_assignment" "grafana" {
  count = var.grafana_oidc_enabled ? 1 : 0

  name       = "grafana"
  entity_ids = var.grafana_user_entity_ids
}

resource "vault_identity_oidc_scope" "grafana_profile" {
  count = var.grafana_oidc_enabled ? 1 : 0

  name        = "profile"
  template    = "{\"name\": {{identity.entity.name}}, \"email\": {{identity.entity.metadata.email}}}"
  description = "Name and email of the entity"
}

resource "vault_identity_oidc_client" "grafana" {
  count = var.grafana_oidc_enabled ? 1 : 0

  name             = "grafana"
  key              = vault_identity_oidc_key.grafana[0].name
  redirect_uris    = var.grafana_redirect_uris
  assignments      = [vault_identity_oidc_assignment.grafana[0].name]
  id_token_ttl     = 3600
  access_token_ttl = 3600
  client_type      = "confidential"
}

resource "vault_identity_oidc_provider" "grafana" {
  count = var.grafana_oidc_enabled ? 1 : 0

  name               = "grafana"
  https_enabled      = true
  issuer_host        = trimprefix(trimprefix(var.vault_address, "https://"), "http://")
  allowed_client_ids = [vault_identity_oidc_client.grafana[0].client_id]
  scopes_supported   = [vault_identity_oidc_scope.grafana_profile[0].name]
}
