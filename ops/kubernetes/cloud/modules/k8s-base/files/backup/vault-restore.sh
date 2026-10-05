#!/usr/bin/env bash
# BREAK-GLASS. Restores a Vault Raft snapshot from S3 into the running cluster
# (POST /v1/sys/storage/raft/snapshot-force). Not part of any schedule: the Job that
# runs it is created suspended and must be resumed by a human after reading the
# runbook. The restored data is sealed with the unseal keys that were current when
# the snapshot was taken.
#
# Environment:
#   RESTORE_CONFIRM=i-understand-this-overwrites-vault   mandatory
#   SNAPSHOT_NAME                                        object name or "latest"
#   VAULT_ADDR VAULT_CACERT VAULT_TOKEN_FILE             target and operator token (manual Secret)
#   SNAPSHOT_PASSPHRASE_FILE BACKUP_S3_URI ...           same as the snapshot job
set -euo pipefail
umask 077

# shellcheck disable=SC2034
SCRIPT_NAME="vault-restore.sh"
# shellcheck source=/dev/null
. /usr/local/bin/lib.sh

[[ "${RESTORE_CONFIRM:-}" == "i-understand-this-overwrites-vault" ]] || die "RESTORE_CONFIRM is not set to the confirmation phrase"
: "${VAULT_ADDR:?}" "${VAULT_CACERT:?}" "${VAULT_TOKEN_FILE:?}" "${SNAPSHOT_PASSPHRASE_FILE:?}" "${BACKUP_S3_URI:?}"
WHAT="${SNAPSHOT_NAME:-latest}"
WORK="${WORK_DIR:-/backups}"
[[ -s "$VAULT_TOKEN_FILE" ]] || die "operator token file is empty or missing"
require_cmds curl gpg sha256sum aws

cleanup() { rm -f -- "$WORK"/.vault-* "$WORK"/vault-raft_* 2>/dev/null || true; }
trap cleanup EXIT

if [[ "$WHAT" == "latest" ]]; then
  WHAT="$(s3_names | grep -E '^vault-raft_[0-9]{8}T[0-9]{6}Z\.snap\.gpg$' | sort -r | sed -n 1p)"
  [[ -n "$WHAT" ]] || die "no Vault snapshot found at $(s3_base)/"
fi
[[ "$WHAT" =~ ^vault-raft_[0-9]{8}T[0-9]{6}Z\.snap\.gpg$ ]] || die "invalid snapshot name"

log "downloading $WHAT"
s3_get "$WHAT" "$WORK/$WHAT"
s3_get "$WHAT.sha256" "$WORK/$WHAT.sha256"
verify_checksum "$WORK/$WHAT"

gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$SNAPSHOT_PASSPHRASE_FILE" \
  --decrypt -o "$WORK/vault-raft_restore.snap" "$WORK/$WHAT"
gzip -t "$WORK/vault-raft_restore.snap" || die "decrypted snapshot is not a valid gzip archive"

printf 'X-Vault-Token: %s\n' "$(cat "$VAULT_TOKEN_FILE")" >"$WORK/.vault-header"
log "restoring $WHAT into $VAULT_ADDR (force)"
curl -sS -m 900 --fail --cacert "$VAULT_CACERT" -X POST -H "@$WORK/.vault-header" \
  --data-binary "@$WORK/vault-raft_restore.snap" "$VAULT_ADDR/v1/sys/storage/raft/snapshot-force"
log "restore request accepted: check 'vault status', unseal with the keys of the snapshot era, then verify KV, Transit and PKI"
