#!/usr/bin/env bash
# Idempotent first-boot and every-boot setup of Vault. Safe to re-run: the second run
# changes nothing.
#
# Steps: wait, operator init (only if /vault/root/init.json is missing), unseal, enable
# secret/ (kv v2) and transit/, create the KEKs, generate app secrets (kv patch, only
# absent keys), enable audit to stdout, write policies, issue the scoped app token.
#
# Environment:
#   INIT_FILE        init output (default /vault/root/init.json, mode 600, outside the repo)
#   TOKEN_FILE       app token (default /vault/init/app-token)
#   POLICY_DIR       policies/*.hcl (default /vault/policies)
#   KEY_DOMAINS      transit domains (default "pii content hash")
#   VAULT_KEY_SHARES / VAULT_KEY_THRESHOLD   Shamir parameters (default 5 / 3)
#   APP_TOKEN_TTL    app token ttl (default 720h)
#   VAULT_DEV=true   dev mode server: no init/unseal, VAULT_TOKEN is the root token,
#                    no app token is issued
set -euo pipefail
umask 077

# shellcheck source=lib.sh source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

SHARES="${VAULT_KEY_SHARES:-5}"
THRESHOLD="${VAULT_KEY_THRESHOLD:-3}"
APP_SECRETS="JWT_ACCESS_SECRET JWT_REFRESH_SECRET OAUTH_STATE_SECRET"
APP_DOCUMENT="app/time-manager"

need vault jq openssl
wait_for_vault

if [ "${VAULT_DEV:-false}" = "true" ]; then
  [ -n "${VAULT_TOKEN:-}" ] || die "VAULT_TOKEN is required in dev mode"
else
  if [ "$(status_field '.initialized')" = "false" ]; then
    [ ! -e "$INIT_FILE" ] || die "$INIT_FILE exists but vault is not initialized; refusing to overwrite key material"
    mkdir -p "$(dirname "$INIT_FILE")"
    temporary="$(mktemp "$(dirname "$INIT_FILE")/.init.XXXXXX")"
    trap 'rm -f "$temporary"' EXIT
    vault operator init -key-shares="$SHARES" -key-threshold="$THRESHOLD" -format=json >"$temporary"
    jq -e '.root_token and (.unseal_keys_b64 | length > 0)' "$temporary" >/dev/null || die "unexpected init output"
    chmod 600 "$temporary"
    mv "$temporary" "$INIT_FILE"
    trap - EXIT
    log "initialized with $SHARES shares, threshold $THRESHOLD; keys stored in $INIT_FILE"
  fi
  [ -r "$INIT_FILE" ] || die "vault is initialized but $INIT_FILE is missing; restore the authoritative offline copy"
  "$(dirname "${BASH_SOURCE[0]}")/unseal.sh" "$INIT_FILE"
  VAULT_TOKEN="$(jq -er '.root_token' "$INIT_FILE")"
  export VAULT_TOKEN
fi

mounts="$(vault secrets list -format=json)"
if ! jq -e 'has("secret/")' <<<"$mounts" >/dev/null; then
  vault secrets enable -path=secret -version=2 kv >/dev/null
  log "enabled secret/ (kv v2)"
fi
if ! jq -e 'has("transit/")' <<<"$mounts" >/dev/null; then
  vault secrets enable transit >/dev/null
  log "enabled transit/"
fi

for domain in $KEY_DOMAINS; do
  key="time-manager-${domain}-kek"
  if ! vault read -format=json "transit/keys/$key" >/dev/null 2>&1; then
    vault write -f "transit/keys/$key" type=aes256-gcm96 exportable=false >/dev/null
    vault write "transit/keys/$key/config" deletion_allowed=false >/dev/null
    log "created transit key $key"
  fi
done

if ! vault kv metadata get -mount=secret "$APP_DOCUMENT" >/dev/null 2>&1; then
  payload="{}"
  for name in $APP_SECRETS; do
    payload="$(jq -c --arg key "$name" --arg value "$(openssl rand -hex 32)" '. + {($key): $value}' <<<"$payload")"
  done
  printf '%s' "$payload" | vault kv put -mount=secret "$APP_DOCUMENT" - >/dev/null
  log "created secret/$APP_DOCUMENT with generated secrets"
else
  current="$(vault kv get -mount=secret -format=json "$APP_DOCUMENT" | jq -c '.data.data')"
  payload="{}"
  for name in $APP_SECRETS; do
    if ! jq -e --arg key "$name" 'has($key)' <<<"$current" >/dev/null; then
      payload="$(jq -c --arg key "$name" --arg value "$(openssl rand -hex 32)" '. + {($key): $value}' <<<"$payload")"
    fi
  done
  if [ "$payload" != "{}" ]; then
    printf '%s' "$payload" | vault kv patch -mount=secret "$APP_DOCUMENT" - >/dev/null
    log "patched missing keys into secret/$APP_DOCUMENT"
  fi
fi

audits="$(vault audit list -format=json)"
if ! jq -e 'has("file/")' <<<"$audits" >/dev/null; then
  vault audit enable file file_path=stdout >/dev/null
  log "enabled stdout audit device"
fi

for policy in "$POLICY_DIR"/*.hcl; do
  name="$(basename "$policy" .hcl)"
  current="$(vault policy read "$name" 2>/dev/null || true)"
  if [ "$current" != "$(cat "$policy")" ]; then
    vault policy write "$name" - <"$policy" >/dev/null
    log "wrote policy $name"
  fi
done

if [ "${VAULT_DEV:-false}" = "true" ]; then
  log "dev mode: no app token issued"
  exit 0
fi

issue=true
if [ -s "$TOKEN_FILE" ]; then
  if VAULT_TOKEN="$(cat "$TOKEN_FILE")" vault token lookup >/dev/null 2>&1; then
    issue=false
  fi
fi
if [ "$issue" = "true" ]; then
  mkdir -p "$(dirname "$TOKEN_FILE")"
  chmod 755 "$(dirname "$TOKEN_FILE")"
  temporary="$(mktemp "$(dirname "$TOKEN_FILE")/.token.XXXXXX")"
  trap 'rm -f "$temporary"' EXIT
  vault token create -policy=app -ttl="${APP_TOKEN_TTL:-720h}" -orphan -display-name=time-manager-app -field=token >"$temporary"
  chmod 644 "$temporary"
  mv "$temporary" "$TOKEN_FILE"
  trap - EXIT
  log "issued app token into $TOKEN_FILE"
fi
log "ready"
