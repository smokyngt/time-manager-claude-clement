#!/usr/bin/env bash
# Raft snapshot of Vault: Kubernetes auth login, snapshot, gpg symmetric
# encryption (AES256), round-trip check, upload to S3 with a checksum, retention.
# Runs inside the ops/backup image; lib.sh provides log/die and the S3 helpers.
#
# Environment:
#   VAULT_ADDR VAULT_CACERT VAULT_ROLE VAULT_AUTH_PATH   how to reach and log in to Vault
#   SNAPSHOT_PASSPHRASE_FILE                              file holding the encryption passphrase
#   BACKUP_S3_URI BACKUP_S3_ENDPOINT_URL AWS_*            destination
#   VAULT_SNAPSHOT_KEEP                                   snapshots kept in S3
set -euo pipefail
umask 077

# shellcheck disable=SC2034
SCRIPT_NAME="vault-snapshot.sh"
# shellcheck source=/dev/null
. /usr/local/bin/lib.sh

: "${VAULT_ADDR:?}" "${VAULT_CACERT:?}" "${VAULT_ROLE:?}" "${VAULT_AUTH_PATH:=kubernetes}"
: "${SNAPSHOT_PASSPHRASE_FILE:?}" "${BACKUP_S3_URI:?}" "${VAULT_SNAPSHOT_KEEP:=42}"
JWT_FILE="${JWT_FILE:-/var/run/secrets/kubernetes.io/serviceaccount/token}"
WORK="${WORK_DIR:-/backups}"
HDR="$WORK/.vault-header"
[[ -s "$SNAPSHOT_PASSPHRASE_FILE" ]] || die "passphrase file is empty or missing"
[[ "$VAULT_SNAPSHOT_KEEP" =~ ^[0-9]+$ && "$VAULT_SNAPSHOT_KEEP" -ge 6 ]] || die "VAULT_SNAPSHOT_KEEP must be an integer >= 6"
require_cmds curl gpg sha256sum aws

TOKEN=""
cleanup() {
  local rc=$?
  if [[ -n "$TOKEN" ]]; then
    curl -sS -m 15 --cacert "$VAULT_CACERT" -X POST -H "@$HDR" "$VAULT_ADDR/v1/auth/token/revoke-self" >/dev/null 2>&1 || true
  fi
  rm -f -- "$WORK"/.vault-* "$WORK"/vault-raft_* 2>/dev/null || true
  if [[ $rc -ne 0 ]]; then err "vault snapshot FAILED (exit $rc)"; fi
}
trap cleanup EXIT

log "logging in to $VAULT_ADDR as role $VAULT_ROLE"
printf '{"role":"%s","jwt":"%s"}' "$VAULT_ROLE" "$(cat "$JWT_FILE")" >"$WORK/.vault-login.json"
TOKEN="$(curl -sS -m 30 --fail --cacert "$VAULT_CACERT" -X POST --data-binary "@$WORK/.vault-login.json" \
  "$VAULT_ADDR/v1/auth/$VAULT_AUTH_PATH/login" | sed -n 's/.*"client_token":"\([^"]*\)".*/\1/p')"
rm -f -- "$WORK/.vault-login.json"
[[ -n "$TOKEN" ]] || die "Vault login returned no client token"
printf 'X-Vault-Token: %s\n' "$TOKEN" >"$HDR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RAW="$WORK/vault-raft_$STAMP.snap"
ENC="vault-raft_$STAMP.snap.gpg"
log "requesting Raft snapshot"
curl -sS -m 900 --fail --cacert "$VAULT_CACERT" -H "@$HDR" -o "$RAW" "$VAULT_ADDR/v1/sys/storage/raft/snapshot"
[[ -s "$RAW" ]] || die "snapshot is empty"
gzip -t "$RAW" || die "snapshot is not a valid gzip archive"
SIZE_RAW="$(wc -c <"$RAW" | tr -d ' ')"
RAW_SUM="$(sha256sum "$RAW" | awk '{print $1}')"

log "encrypting ($SIZE_RAW bytes)"
gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$SNAPSHOT_PASSPHRASE_FILE" \
  --symmetric --cipher-algo AES256 --compress-algo none -o "$WORK/$ENC" "$RAW"
DEC_SUM="$(gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$SNAPSHOT_PASSPHRASE_FILE" --decrypt "$WORK/$ENC" | sha256sum | awk '{print $1}')"
[[ "$RAW_SUM" == "$DEC_SUM" ]] || die "encryption round trip failed"
rm -f -- "$RAW"
(cd "$WORK" && sha256sum -- "$ENC" >"$ENC.sha256")

log "uploading $ENC"
s3_put "$WORK/$ENC" "$ENC"
s3_put "$WORK/$ENC.sha256" "$ENC.sha256"

mapfile -t OLD < <(s3_names | grep -E '^vault-raft_[0-9]{8}T[0-9]{6}Z\.snap\.gpg$' | sort -r | tail -n +$((VAULT_SNAPSHOT_KEEP + 1)))
for name in "${OLD[@]}"; do
  [[ -n "$name" ]] || continue
  log "retention: removing $name"
  s3_rm "$name"
  s3_rm "$name.sha256" || true
done
log "vault snapshot OK: $ENC"
