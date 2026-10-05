#!/usr/bin/env bash
# Unseal Vault with the keys stored by init.sh. Safe to re-run.
#
# Usage: unseal.sh [init-file]      (default INIT_FILE=/vault/root/init.json)
#
# Host usage with the compose stack:
#   docker compose -f docker-compose.yml -f docker-compose.vault.yml run --rm vault-init /vault/bin/unseal.sh
#
# The vault CLI only takes a key as an argument (visible in the process list), so the
# keys are posted to /v1/sys/unseal with curl, the body travelling on stdin.
set -euo pipefail
umask 077

# shellcheck source=lib.sh source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

FILE="${1:-$INIT_FILE}"
need jq curl vault
[ -r "$FILE" ] || die "cannot read $FILE"
wait_for_vault

[ "$(status_field '.initialized')" = "true" ] || die "vault is not initialized (run init.sh)"
if [ "$(status_field '.sealed')" = "false" ]; then
  log "already unsealed"
  exit 0
fi

CURL_ARGS=(--fail --silent --show-error --max-time 10 --request PUT)
if [ -n "${VAULT_CACERT:-}" ]; then
  CURL_ARGS+=(--cacert "$VAULT_CACERT")
fi

sealed=true
applied=0
while IFS= read -r key; do
  [ "$sealed" = "true" ] || break
  reply="$(jq -cn --arg key "$key" '{key: $key}' | curl "${CURL_ARGS[@]}" --data @- "$VAULT_ADDR/v1/sys/unseal")"
  sealed="$(jq -r '.sealed' <<<"$reply")"
  applied=$((applied + 1))
done < <(jq -r '.unseal_keys_b64[]' "$FILE")

[ "$sealed" = "false" ] || die "still sealed after $applied keys; check the init file is the authoritative copy"
log "unsealed with $applied keys"
