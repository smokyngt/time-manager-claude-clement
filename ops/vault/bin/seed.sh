#!/usr/bin/env bash
# Copy the secrets of an .env file into Vault KV v2 (mount secret/).
#
# Usage: seed.sh --env-file FILE [--init-file FILE] [--allow-placeholders]
#
# Layout written:
#   secret/time-manager/api     JWT_*, OAUTH_STATE_SECRET, ENCRYPTION_KEY*, HASH_KEY,
#                               DATABASE_URL, MICROSOFT_CLIENT_SECRET, METRICS_TOKEN,
#                               SEED_ADMIN_PASSWORD
#   secret/time-manager/shared  POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
#   secret/time-manager/backup  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
#                               BACKUP_ALERT_WEBHOOK, BACKUP_HEARTBEAT_URL
#
# Empty values are skipped. DATABASE_URL is built from POSTGRES_* (host db)
# when absent. The file is parsed, never sourced. Values travel on stdin only.
# Each run writes a new KV version; older versions stay readable for rollback.
set -euo pipefail
umask 077

# shellcheck source=lib.sh source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

ENV_FILE=""
INIT_FILE=""
PLACEHOLDERS=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --env-file) ENV_FILE="${2:?--env-file needs a value}"; shift 2 ;;
    --init-file) INIT_FILE="${2:?--init-file needs a value}"; shift 2 ;;
    --allow-placeholders) PLACEHOLDERS=1; shift ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "$ENV_FILE" ] || die "usage: seed.sh --env-file FILE [--init-file FILE]"
[ -r "$ENV_FILE" ] || die "cannot read $ENV_FILE"
need jq
token_from "$INIT_FILE"
require_unsealed

declare -A VALUES=()
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"
  [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
  key="${BASH_REMATCH[1]}"
  value="${BASH_REMATCH[2]}"
  if [[ "$value" =~ ^\"(.*)\"$ ]] || [[ "$value" =~ ^\'(.*)\'$ ]]; then
    value="${BASH_REMATCH[1]}"
  fi
  VALUES["$key"]="$value"
done <"$ENV_FILE"

if [ -z "${VALUES[DATABASE_URL]:-}" ] && [ -n "${VALUES[POSTGRES_PASSWORD]:-}" ]; then
  VALUES[DATABASE_URL]="$(jq -rn \
    --arg user "${VALUES[POSTGRES_USER]:-timemanager}" \
    --arg password "${VALUES[POSTGRES_PASSWORD]}" \
    --arg database "${VALUES[POSTGRES_DB]:-timemanager}" \
    '"postgres://\($user | @uri):\($password | @uri)@db:5432/\($database)"')"
fi

API_KEYS=(DATABASE_URL ENCRYPTION_KEY ENCRYPTION_KEY_ID ENCRYPTION_KEYS_PREVIOUS HASH_KEY JWT_ACCESS_SECRET JWT_REFRESH_SECRET METRICS_TOKEN MICROSOFT_CLIENT_SECRET OAUTH_STATE_SECRET SEED_ADMIN_PASSWORD)
SHARED_KEYS=(POSTGRES_DB POSTGRES_PASSWORD POSTGRES_USER)
BACKUP_KEYS=(AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY BACKUP_ALERT_WEBHOOK BACKUP_HEARTBEAT_URL)
REQUIRED=(DATABASE_URL ENCRYPTION_KEY HASH_KEY JWT_ACCESS_SECRET JWT_REFRESH_SECRET)

for key in "${REQUIRED[@]}"; do
  [ -n "${VALUES[$key]:-}" ] || die "$key is missing or empty in $ENV_FILE"
done

if [ "$PLACEHOLDERS" -eq 0 ]; then
  for key in "${!VALUES[@]}"; do
    case "$key" in
      DATABASE_URL | ENCRYPTION_KEY | HASH_KEY | JWT_* | METRICS_TOKEN | MICROSOFT_CLIENT_SECRET | OAUTH_STATE_SECRET | POSTGRES_PASSWORD | SEED_ADMIN_PASSWORD)
        if [[ "${VALUES[$key]}" =~ [Cc][Hh][Aa][Nn][Gg][Ee][_-]?[Mm][Ee] ]]; then
          die "$key still holds a CHANGE_ME placeholder (use --allow-placeholders for local tests only)"
        fi
        ;;
      *) ;;
    esac
  done
fi

put() {
  local path="$1" count=0 key payload
  shift
  payload="{}"
  for key in "$@"; do
    [ -n "${VALUES[$key]:-}" ] || continue
    payload="$(jq -c --arg key "$key" --arg value "${VALUES[$key]}" '. + {($key): $value}' <<<"$payload")"
    count=$((count + 1))
  done
  [ "$count" -gt 0 ] || { log "skipped secret/$path (nothing to write)"; return 0; }
  printf '%s' "$payload" | vault kv put -mount=secret "$path" - >/dev/null
  log "wrote secret/$path ($count keys)"
}

put time-manager/api "${API_KEYS[@]}"
put time-manager/shared "${SHARED_KEYS[@]}"
put time-manager/backup "${BACKUP_KEYS[@]}"

log "done. Remove these secrets from the .env file used by compose; keep non-secret settings."
