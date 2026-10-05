#!/bin/sh
# Export the app token as VAULT_TOKEN, then exec the service.
# Usage: token-entrypoint.sh <command> [args...]
# Environment: VAULT_TOKEN_FILE (default /vault/init/app-token)
set -eu

file="${VAULT_TOKEN_FILE:-/vault/init/app-token}"
if [ ! -s "$file" ]; then
  echo "[VAULT] error: token file $file is missing or empty" >&2
  exit 1
fi
VAULT_TOKEN="$(cat "$file")"
export VAULT_TOKEN
exec "$@"
