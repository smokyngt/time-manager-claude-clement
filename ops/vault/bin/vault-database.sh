#!/usr/bin/env bash
# OPT-IN: enable the database secrets engine for dynamic PostgreSQL credentials.
#
# Usage: vault-database.sh --init-file FILE [--host db] [--database timemanager]
#                          [--attach]
#
# Environment:
#   VAULT_DB_ADMIN_USER      PostgreSQL role Vault uses to create users (required)
#   VAULT_DB_ADMIN_PASSWORD  its password (required, read from the environment only)
#   VAULT_DB_TTL / VAULT_DB_MAX_TTL   lease ttl (default 1h / 24h)
#   VAULT_DB_SSLMODE         sslmode in the connection url (default disable)
#
# Creates mount database/, config time-manager, role time-manager-api (DML on
# the public schema) and rotates the admin password so only Vault knows it.
# Re-run after a migration adds tables, or grant default privileges to the
# owner role. Migrations need DDL: run them with a static owner DATABASE_URL.
# --attach adds the time-manager-database policy to the api AppRole.
set -euo pipefail
umask 077

# shellcheck source=lib.sh source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

INIT_FILE=""
HOST="db"
DATABASE="timemanager"
ATTACH=0
TTL="${VAULT_DB_TTL:-1h}"
MAX_TTL="${VAULT_DB_MAX_TTL:-24h}"
SSLMODE="${VAULT_DB_SSLMODE:-disable}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --init-file) INIT_FILE="${2:?--init-file needs a value}"; shift 2 ;;
    --host) HOST="${2:?--host needs a value}"; shift 2 ;;
    --database) DATABASE="${2:?--database needs a value}"; shift 2 ;;
    --attach) ATTACH=1; shift ;;
    *) die "unknown argument: $1" ;;
  esac
done

: "${VAULT_DB_ADMIN_USER:?VAULT_DB_ADMIN_USER is required}"
: "${VAULT_DB_ADMIN_PASSWORD:?VAULT_DB_ADMIN_PASSWORD is required}"
need jq
token_from "$INIT_FILE"
require_unsealed

mounts="$(vault secrets list -format=json)"
if ! jq -e 'has("database/")' <<<"$mounts" >/dev/null; then
  vault secrets enable database >/dev/null
  log "enabled database engine"
fi

jq -n \
  --arg url "postgresql://{{username}}:{{password}}@$HOST:5432/$DATABASE?sslmode=$SSLMODE" \
  --arg user "$VAULT_DB_ADMIN_USER" \
  --arg password "$VAULT_DB_ADMIN_PASSWORD" \
  '{plugin_name: "postgresql-database-plugin", allowed_roles: "time-manager-api", connection_url: $url, username: $user, password: $password, password_authentication: "scram-sha-256"}' |
  vault write database/config/time-manager - >/dev/null
vault write -f database/rotate-root/time-manager >/dev/null
log "configured connection and rotated the admin password"

creation="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT USAGE ON SCHEMA public TO \"{{name}}\"; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO \"{{name}}\"; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO \"{{name}}\";"
revocation="REVOKE ALL ON ALL TABLES IN SCHEMA public FROM \"{{name}}\"; REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM \"{{name}}\"; REVOKE ALL ON SCHEMA public FROM \"{{name}}\"; DROP ROLE IF EXISTS \"{{name}}\";"
vault write database/roles/time-manager-api \
  db_name=time-manager \
  "creation_statements=$creation" \
  "revocation_statements=$revocation" \
  "default_ttl=$TTL" \
  "max_ttl=$MAX_TTL" >/dev/null
log "role time-manager-api: ttl $TTL, max ttl $MAX_TTL"

vault policy write time-manager-database - <"$VAULT_OPS_DIR/policies/time-manager-database.hcl" >/dev/null

if [ "$ATTACH" -eq 1 ]; then
  vault write auth/approle/role/time-manager-api token_policies=time-manager-api,time-manager-database >/dev/null
  log "attached time-manager-database to the api AppRole"
fi

log "read credentials with: vault read database/creds/time-manager-api"
