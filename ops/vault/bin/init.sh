#!/usr/bin/env bash
# Initialize a fresh Vault and store the unseal keys and root token in a file.
#
# Usage: init.sh <output-file>
#
# The output file must live OUTSIDE this repository and must not exist yet.
# It contains every unseal key and the root token: move it to a password
# manager or an offline medium, then split the keys between people.
#
# Environment:
#   VAULT_KEY_SHARES     number of unseal key shares (default 5)
#   VAULT_KEY_THRESHOLD  shares needed to unseal (default 3)
set -euo pipefail
umask 077

# shellcheck source=lib.sh source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[ "$#" -eq 1 ] || die "usage: init.sh <output-file>"
OUTPUT="$1"
SHARES="${VAULT_KEY_SHARES:-5}"
THRESHOLD="${VAULT_KEY_THRESHOLD:-3}"

need jq realpath
if inside_repo "$OUTPUT"; then
  die "REFUSING: $OUTPUT is inside the repository ($REPO_ROOT). Keys and root token must never live in the repo; pick a path elsewhere, for example ~/.vault/time-manager.init.json"
fi
[ ! -e "$OUTPUT" ] || die "$OUTPUT already exists; refusing to overwrite"
[[ "$SHARES" =~ ^[0-9]+$ && "$THRESHOLD" =~ ^[0-9]+$ ]] || die "shares and threshold must be integers"
[ "$THRESHOLD" -ge 2 ] && [ "$THRESHOLD" -le "$SHARES" ] || die "threshold must be between 2 and the number of shares"

status="$(vault status -format=json 2>/dev/null || true)"
[ -n "$status" ] || die "cannot reach vault at $VAULT_ADDR"
[ "$(jq -r '.initialized' <<<"$status")" = "false" ] || die "vault is already initialized"

mkdir -p "$(dirname "$OUTPUT")"
temporary="$(mktemp "$(dirname "$OUTPUT")/.vault-init.XXXXXX")"
trap 'rm -f "$temporary"' EXIT
vault operator init -key-shares="$SHARES" -key-threshold="$THRESHOLD" -format=json >"$temporary"
jq -e '.root_token and (.unseal_keys_b64 | length > 0)' "$temporary" >/dev/null || die "unexpected init output"
chmod 600 "$temporary"
mv "$temporary" "$OUTPUT"
trap - EXIT

log "initialized: $SHARES key shares, threshold $THRESHOLD"
log "keys and root token written to $OUTPUT (mode 600)"
log "next: unseal.sh $OUTPUT, then configure.sh --init-file $OUTPUT"
