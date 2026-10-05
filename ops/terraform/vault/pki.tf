resource "vault_mount" "pki_root" {
  path                  = "pki-root"
  type                  = "pki"
  description           = "Time Manager root CA"
  max_lease_ttl_seconds = 315360000
}

resource "vault_mount" "pki_internal" {
  path                  = "pki-internal"
  type                  = "pki"
  description           = "Time Manager internal intermediate CA"
  max_lease_ttl_seconds = 31536000
}

resource "vault_pki_secret_backend_root_cert" "root" {
  backend      = vault_mount.pki_root.path
  type         = "internal"
  common_name  = var.pki_common_name
  ttl          = "87600h"
  key_type     = "ec"
  key_bits     = 256
  issuer_name  = "root"
  organization = var.pki_organization
}

resource "vault_pki_secret_backend_intermediate_cert_request" "internal" {
  backend      = vault_mount.pki_internal.path
  type         = "internal"
  common_name  = "${var.pki_common_name} - Internal"
  key_type     = "ec"
  key_bits     = 256
  organization = var.pki_organization
}

resource "vault_pki_secret_backend_root_sign_intermediate" "internal" {
  backend      = vault_mount.pki_root.path
  csr          = vault_pki_secret_backend_intermediate_cert_request.internal.csr
  common_name  = "${var.pki_common_name} - Internal"
  ttl          = "8760h"
  format       = "pem_bundle"
  revoke       = true
  organization = var.pki_organization
  depends_on   = [vault_pki_secret_backend_root_cert.root]
}

resource "vault_pki_secret_backend_intermediate_set_signed" "internal" {
  backend     = vault_mount.pki_internal.path
  certificate = vault_pki_secret_backend_root_sign_intermediate.internal.certificate_bundle
}

resource "vault_pki_secret_backend_config_urls" "root" {
  backend                 = vault_mount.pki_root.path
  issuing_certificates    = ["${var.pki_issuing_url}/${vault_mount.pki_root.path}/ca"]
  crl_distribution_points = ["${var.pki_issuing_url}/${vault_mount.pki_root.path}/crl"]
}

resource "vault_pki_secret_backend_config_urls" "internal" {
  backend                 = vault_mount.pki_internal.path
  issuing_certificates    = ["${var.pki_issuing_url}/${vault_mount.pki_internal.path}/ca"]
  crl_distribution_points = ["${var.pki_issuing_url}/${vault_mount.pki_internal.path}/crl"]
}

resource "vault_pki_secret_backend_config_issuers" "internal" {
  backend                       = vault_mount.pki_internal.path
  default                       = vault_pki_secret_backend_intermediate_set_signed.internal.imported_issuers[0]
  default_follows_latest_issuer = true
}

resource "vault_pki_secret_backend_role" "api_server" {
  backend            = vault_mount.pki_internal.path
  name               = "api-server"
  allowed_domains    = var.pki_allowed_domains
  allow_bare_domains = true
  allow_subdomains   = false
  allow_localhost    = true
  allow_ip_sans      = true
  enforce_hostnames  = true
  server_flag        = true
  client_flag        = true
  key_type           = "ec"
  key_bits           = 256
  ttl                = 86400
  max_ttl            = 259200
  generate_lease     = true
  no_store           = false

  depends_on = [vault_pki_secret_backend_intermediate_set_signed.internal]
}

resource "vault_pki_secret_backend_role" "internal_services" {
  backend            = vault_mount.pki_internal.path
  name               = "internal-services"
  allowed_domains    = var.pki_allowed_domains
  allow_bare_domains = true
  allow_subdomains   = true
  allow_ip_sans      = true
  enforce_hostnames  = true
  server_flag        = true
  client_flag        = true
  key_type           = "ec"
  key_bits           = 256
  ttl                = 86400
  max_ttl            = 259200
  generate_lease     = true
  no_store           = false

  depends_on = [vault_pki_secret_backend_intermediate_set_signed.internal]
}
