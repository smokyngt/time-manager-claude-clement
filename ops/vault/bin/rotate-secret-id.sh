#!/usr/bin/env bash
# Issue a new AppRole secret_id and replace the mounted file atomically.
#
# Usage: rotate-secret-id.sh [--role api|backup] [--out DIR] [--init-file FILE]
#                            [--revoke-old]
#
#   --role        api (default) or backup
#   --out         directory holding <role>_secret_id (default ops/vault/secrets)
#   --init-file   init.sh output; alternatively export VAULT_TOKEN (an operator
#                 token with the time-manager-operator policy is enough)
#   --revoke-old  destroy the secret_ids that existed before the rotation
#
# The api re-reads the file on every login, so no restart is needed; a restart
# also picks the new value. Schedule this before VAULT_SECRET_ID_TTL elapses.
set -euo pipefail
umask 077

# shellcheck source=lib.sh source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

ROLE="api"
OUT="$VAULT_OPS_DIR/secrets"
INIT_FILE=""
REVOKE=0
FILE_MODE="${VAULT_SECRET_FILE_MODE:-644}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --role) ROLE="${2:?--role needs a value}"; shift 2 ;;
    --out) OUT="${2:?--out needs a value}"; shift 2 ;;
    --init-file) INIT_FILE="${2:?--init-file needs a value}"; shift 2 ;;
    --revoke-old) REVOKE=1; shift ;;
    *) die "unknown argument: $1" ;;
  esac
done

case "$ROLE" in
  api | backup) ;;
  *) die "--role must be api or backup" ;;
esac

need jq
token_from "$INIT_FILE"
require_unsealed
[ -d "$OUT" ] || die "$OUT does not exist (run configure.sh first)"

NAME="time-manager-$ROLE"
TARGET="$OUT/${ROLE}_secret_id"
previous=""
if [ "$REVOKE" -eq 1 ]; then
  previous="$(vault list -format=json "auth/approle/role/$NAME/secret-id" | jq -r '.[]')"
fi

temporary="$(mktemp "$OUT/.secret-id.XXXXXX")"
trap 'rm -f "$temporary"' EXIT
fresh="$(vault write -f -format=json "auth/approle/role/$NAME/secret-id")"
jq -er '.data.secret_id' <<<"$fresh" >"$temporary"
chmod "$FILE_MODE" "$temporary"
mv "$temporary" "$TARGET"
trap - EXIT
log "wrote new secret_id to $TARGET"

if [ "$REVOKE" -eq 1 ]; then
  newest="$(jq -er '.data.secret_id_accessor' <<<"$fresh")"
  while IFS= read -r accessor; do
    [ -n "$accessor" ] && [ "$accessor" != "$newest" ] || continue
    printf '{"secret_id_accessor":"%s"}' "$accessor" |
      vault write "auth/approle/role/$NAME/secret-id-accessor/destroy" - >/dev/null
    log "destroyed old accessor $accessor"
  done <<<"$previous"
fi
