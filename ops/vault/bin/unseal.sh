#!/usr/bin/env bash
# Unseal Vault with the keys stored by init.sh.
#
# Usage: unseal.sh <init-file>
#
# Applies keys one by one until Vault reports unsealed. The vault CLI only accepts
# a key as an argument (visible in the process list), so the keys are posted to
# /v1/sys/unseal with curl, the body travelling on stdin.
set -euo pipefail
umask 077

# shellcheck source=lib.sh source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[ "$#" -eq 1 ] || die "usage: unseal.sh <init-file>"
FILE="$1"
need jq curl
[ -r "$FILE" ] || die "cannot read $FILE"

status="$(vault status -format=json 2>/dev/null || true)"
[ -n "$status" ] || die "cannot reach vault at $VAULT_ADDR"
[ "$(jq -r '.initialized' <<<"$status")" = "true" ] || die "vault is not initialized (run init.sh)"
if [ "$(jq -r '.sealed' <<<"$status")" = "false" ]; then
  log "vault is already unsealed"
  exit 0
fi

CURL_ARGS=(--fail --silent --show-error --max-time 10 --request PUT)
if [ -n "${VAULT_CACERT:-}" ]; then
  CURL_ARGS+=(--cacert "$VAULT_CACERT")
fi
applied=0
while IFS= read -r key; do
  [ "$(jq -r '.sealed' <<<"$status")" = "true" ] || break
  status="$(jq -cn --arg key "$key" '{key: $key}' | curl "${CURL_ARGS[@]}" --data @- "$VAULT_ADDR/v1/sys/unseal")"
  applied=$((applied + 1))
done < <(jq -r '.unseal_keys_b64[]' "$FILE")

[ "$(jq -r '.sealed' <<<"$status")" = "false" ] || die "still sealed after $applied keys"
log "unsealed with $applied keys"
