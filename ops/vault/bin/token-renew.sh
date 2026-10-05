#!/usr/bin/env bash
# Keep the app token alive and report its remaining lifetime.
#
# Renews the token when its ttl drops under RENEW_BELOW, and issues a replacement
# (root token from the init file) when renewal cannot extend it, for example near the
# max ttl. Prints "ttl_seconds=<n>" and exits 1 when the token is under ALERT_BELOW
# after the attempt, so a cron job or monitor can alert.
#
# Environment:
#   TOKEN_FILE     app token file (default /vault/init/app-token)
#   INIT_FILE      init output used to issue a replacement
#   RENEW_BELOW    seconds (default 604800, 7 days)
#   ALERT_BELOW    seconds (default 259200, 3 days)
#   APP_TOKEN_TTL  ttl of a replacement (default 720h)
#   PROM_FILE      optional node-exporter textfile written with vault_app_token_ttl_seconds
#
# A replaced token only reaches running services after they restart; a renewed one is
# picked up transparently.
set -euo pipefail
umask 077

# shellcheck source=lib.sh source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

RENEW_BELOW="${RENEW_BELOW:-604800}"
ALERT_BELOW="${ALERT_BELOW:-259200}"
need vault jq
[ -s "$TOKEN_FILE" ] || die "no token file at $TOKEN_FILE (run init.sh)"
wait_for_vault

remaining() {
  VAULT_TOKEN="$(cat "$TOKEN_FILE")" vault token lookup -format=json 2>/dev/null | jq -r '.data.ttl' || echo 0
}

ttl="$(remaining)"
if [ "$ttl" -lt "$RENEW_BELOW" ]; then
  VAULT_TOKEN="$(cat "$TOKEN_FILE")" vault token renew >/dev/null 2>&1 || true
  ttl="$(remaining)"
fi
if [ "$ttl" -lt "$RENEW_BELOW" ]; then
  [ -r "$INIT_FILE" ] || die "token ttl is $ttl and $INIT_FILE is unavailable to issue a replacement"
  temporary="$(mktemp "$(dirname "$TOKEN_FILE")/.token.XXXXXX")"
  trap 'rm -f "$temporary"' EXIT
  VAULT_TOKEN="$(jq -er '.root_token' "$INIT_FILE")" \
    vault token create -policy=app -ttl="${APP_TOKEN_TTL:-720h}" -orphan -display-name=time-manager-app -field=token >"$temporary"
  chmod 644 "$temporary"
  mv "$temporary" "$TOKEN_FILE"
  trap - EXIT
  log "issued a replacement app token; restart the services that use it"
  ttl="$(remaining)"
fi

printf 'ttl_seconds=%s\n' "$ttl"
if [ -n "${PROM_FILE:-}" ]; then
  printf 'vault_app_token_ttl_seconds %s\n' "$ttl" >"$PROM_FILE.tmp"
  mv "$PROM_FILE.tmp" "$PROM_FILE"
fi
[ "$ttl" -ge "$ALERT_BELOW" ] || exit 1
