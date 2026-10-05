#!/usr/bin/env bash
# Configure an initialized, unsealed Vault for Time Manager. Idempotent.
#
# Usage: configure.sh [--init-file FILE] [--out DIR] [--cidrs CIDR[,CIDR]]
#                     [--container NAME] [--rotate]
#
#   --init-file  init.sh output (root token); alternatively export VAULT_TOKEN
#   --out        directory for role_id / secret_id files
#                (default ops/vault/secrets, git-ignored, mode 700)
#   --cidrs      CIDRs allowed to log in (secret_id and token binding)
#   --container  compose container whose network subnet is used as --cidrs
#   --rotate     issue new secret_ids even if the files already exist
#
# Environment:
#   VAULT_SECRET_ID_TTL  secret_id lifetime. 0 (default) never expires; use 720h
#                        (30 days) together with a rotate-secret-id.sh schedule
#   VAULT_TOKEN_TTL      token ttl (default 1h)
#   VAULT_TOKEN_MAX_TTL  token max ttl (default 24h)
#   VAULT_SECRET_FILE_MODE  mode of the written files (default 644, readable by
#                        the unprivileged container user; the directory is 700)
#
# Output files in --out: api_role_id, api_secret_id, backup_role_id, backup_secret_id
set -euo pipefail
umask 077

# shellcheck source=lib.sh source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

INIT_FILE=""
OUT="$VAULT_OPS_DIR/secrets"
CIDRS="${VAULT_BIND_CIDRS:-}"
CONTAINER=""
ROTATE=0
SECRET_ID_TTL="${VAULT_SECRET_ID_TTL:-0}"
TOKEN_TTL="${VAULT_TOKEN_TTL:-1h}"
TOKEN_MAX_TTL="${VAULT_TOKEN_MAX_TTL:-24h}"
FILE_MODE="${VAULT_SECRET_FILE_MODE:-644}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --init-file) INIT_FILE="${2:?--init-file needs a value}"; shift 2 ;;
    --out) OUT="${2:?--out needs a value}"; shift 2 ;;
    --cidrs) CIDRS="${2:?--cidrs needs a value}"; shift 2 ;;
    --container) CONTAINER="${2:?--container needs a value}"; shift 2 ;;
    --rotate) ROTATE=1; shift ;;
    *) die "unknown argument: $1" ;;
  esac
done

need jq
token_from "$INIT_FILE"
require_unsealed

if [ -z "$CIDRS" ] && [ -n "$CONTAINER" ]; then
  CIDRS="$(subnet_of "$CONTAINER")"
fi
if [ -z "$CIDRS" ]; then
  log "warning: no CIDR binding; any client holding the secret_id can log in"
fi

mounts="$(vault secrets list -format=json)"
if ! jq -e 'has("secret/")' <<<"$mounts" >/dev/null; then
  vault secrets enable -path=secret -version=2 kv >/dev/null
  log "enabled kv v2 at secret/"
fi

methods="$(vault auth list -format=json)"
if ! jq -e 'has("approle/")' <<<"$methods" >/dev/null; then
  vault auth enable approle >/dev/null
  log "enabled approle"
fi

audits="$(vault audit list -format=json)"
if ! jq -e 'has("file/")' <<<"$audits" >/dev/null; then
  vault audit enable file file_path=stdout >/dev/null
  log "enabled stdout audit device"
fi

for policy in "$VAULT_OPS_DIR"/policies/*.hcl; do
  name="$(basename "$policy" .hcl)"
  vault policy write "$name" - <"$policy" >/dev/null
  log "wrote policy $name"
done

mkdir -p "$OUT"
chmod 700 "$OUT"

role() {
  local name="$1" policy="$2" prefix="$3" args id_file secret_file
  args=(
    "token_policies=$policy"
    "token_ttl=$TOKEN_TTL"
    "token_max_ttl=$TOKEN_MAX_TTL"
    "token_num_uses=0"
    "secret_id_ttl=$SECRET_ID_TTL"
    "secret_id_num_uses=0"
  )
  if [ -n "$CIDRS" ]; then
    args+=("secret_id_bound_cidrs=$CIDRS" "token_bound_cidrs=$CIDRS")
  fi
  vault write "auth/approle/role/$name" "${args[@]}" >/dev/null
  id_file="$OUT/${prefix}_role_id"
  secret_file="$OUT/${prefix}_secret_id"
  vault read -field=role_id "auth/approle/role/$name/role-id" >"$id_file"
  chmod "$FILE_MODE" "$id_file"
  if [ "$ROTATE" -eq 1 ] || [ ! -s "$secret_file" ]; then
    vault write -f -field=secret_id "auth/approle/role/$name/secret-id" >"$secret_file"
    chmod "$FILE_MODE" "$secret_file"
    log "wrote $secret_file"
  else
    log "kept existing $secret_file (use --rotate to replace)"
  fi
  log "role $name ready: ttl $TOKEN_TTL, max ttl $TOKEN_MAX_TTL, secret_id_ttl $SECRET_ID_TTL"
}

role time-manager-api time-manager-api api
role time-manager-backup time-manager-backup backup

log "files in $OUT are meant to be mounted as Docker secrets (docker-compose.vault.yml)"
log "next: seed.sh --env-file .env; then revoke the root token and use a time-manager-operator token"
