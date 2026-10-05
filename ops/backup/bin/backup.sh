#!/usr/bin/env bash
# Create a compressed, checksummed (optionally encrypted) pg_dump of the
# production database, apply retention locally and remotely, upload offsite.
#
# Usage: backup.sh [--prune-only]
#
# Environment (all optional unless noted):
#   DATABASE_URL | BACKUP_DATABASE_URL | PGHOST/PGUSER/PGPASSWORD/PGDATABASE
#                        source database (POSTGRES_* are used as a fallback)
#   BACKUP_DIR           where backups live (default /backups)
#   BACKUP_COMPRESSION   pg_dump -Z value, e.g. 6 or zstd:3 (default 6)
#   BACKUP_AGE_RECIPIENT age recipient(s), comma separated -> *.dump.age
#   BACKUP_ENCRYPTION_RECIPIENT  gpg recipient             -> *.dump.gpg
#   BACKUP_GPG_PUBLIC_KEY_FILE   public key imported before gpg encryption
#   BACKUP_S3_URI        s3://bucket/prefix for offsite copies
#   BACKUP_S3_ENDPOINT_URL  endpoint of an S3-compatible service (MinIO, R2...)
#   BACKUP_S3_CLIENT     aws, rclone or auto (default: aws if installed, else rclone)
#   BACKUP_KEEP_DAILY / _WEEKLY / _MONTHLY   retention (7 / 4 / 6)
#   BACKUP_ALERT_WEBHOOK URL called with a JSON message when a run fails
#   BACKUP_HEARTBEAT_URL URL pinged (GET) after each successful run
#
# On success, BACKUP_DIR/last-success and BACKUP_DIR/metrics.prom are updated.
set -euo pipefail
umask 077

SCRIPT_NAME="backup.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh source-path=SCRIPTDIR
. "$SCRIPT_DIR/lib.sh"

PRUNE_ONLY=false
case "${1:-}" in
  "") ;;
  --prune-only) PRUNE_ONLY=true ;;
  -h | --help)
    awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"
    exit 0
    ;;
  *) die "unknown argument: $1" ;;
esac

PARTIAL=""
ENC_PARTIAL=""

on_exit() {
  local rc=$?
  [[ -z "$PARTIAL" ]] || rm -f -- "$PARTIAL"
  [[ -z "$ENC_PARTIAL" ]] || rm -f -- "$ENC_PARTIAL"
  if [[ $rc -ne 0 ]]; then
    err "backup FAILED (exit $rc) for $(conn_id)"
    notify_failure "Time Manager backup FAILED on $(hostname) at $(date -u +%Y-%m-%dT%H:%M:%SZ) (exit $rc). Check the backup container logs."
  fi
}
trap on_exit EXIT

use_source_conn
require_uint BACKUP_KEEP_DAILY "$BACKUP_KEEP_DAILY"
require_uint BACKUP_KEEP_WEEKLY "$BACKUP_KEEP_WEEKLY"
require_uint BACKUP_KEEP_MONTHLY "$BACKUP_KEEP_MONTHLY"
[[ "$BACKUP_KEEP_DAILY" -ge 1 ]] || die "BACKUP_KEEP_DAILY must be at least 1"

AGE_RECIPIENT="${BACKUP_AGE_RECIPIENT:-}"
GPG_RECIPIENT="${BACKUP_ENCRYPTION_RECIPIENT:-}"
if [[ -n "$AGE_RECIPIENT" && -n "$GPG_RECIPIENT" ]]; then
  die "set only one of BACKUP_AGE_RECIPIENT and BACKUP_ENCRYPTION_RECIPIENT"
fi

mkdir -p "$BACKUP_DIR"

if command -v flock >/dev/null 2>&1; then
  exec 9>"$BACKUP_DIR/.lock"
  flock -n 9 || die "another backup is already running"
fi

if $PRUNE_ONLY; then
  log "prune-only: applying retention (daily=$BACKUP_KEEP_DAILY weekly=$BACKUP_KEEP_WEEKLY monthly=$BACKUP_KEEP_MONTHLY)"
  prune_local
  if [[ -n "$BACKUP_S3_URI" ]]; then s3_client >/dev/null; prune_remote; fi
  log "prune-only done"
  exit 0
fi

require_cmds pg_dump pg_restore sha256sum
[[ -z "$AGE_RECIPIENT" ]] || require_cmds age
[[ -z "$GPG_RECIPIENT" ]] || require_cmds gpg
[[ -z "$BACKUP_S3_URI" ]] || s3_client >/dev/null

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="$(backup_prefix)_${STAMP}.dump"
PARTIAL="$BACKUP_DIR/.${NAME}.partial"
COMPRESSION="${BACKUP_COMPRESSION:-6}"

log "starting backup of $(conn_id) -> $NAME (compression=$COMPRESSION)"
pg_dump --format=custom --compress="$COMPRESSION" --no-owner --file="$PARTIAL"

# A dump that cannot be listed is useless: fail early rather than rotate good ones out.
pg_restore --list "$PARTIAL" >/dev/null || die "dump failed integrity check (pg_restore --list)"
SIZE_PLAIN="$(wc -c <"$PARTIAL" | tr -d ' ')"

FINAL="$NAME"
if [[ -n "$AGE_RECIPIENT" ]]; then
  FINAL="$NAME.age"
  ENC_PARTIAL="$BACKUP_DIR/.${FINAL}.partial"
  args=()
  IFS=',' read -r -a recipients <<<"$AGE_RECIPIENT"
  for r in "${recipients[@]}"; do
    r="${r//[[:space:]]/}"
    [[ -z "$r" ]] || args+=(-r "$r")
  done
  [[ ${#args[@]} -gt 0 ]] || die "BACKUP_AGE_RECIPIENT contains no recipient"
  age --encrypt "${args[@]}" -o "$ENC_PARTIAL" "$PARTIAL"
  log "encrypted with age"
elif [[ -n "$GPG_RECIPIENT" ]]; then
  FINAL="$NAME.gpg"
  ENC_PARTIAL="$BACKUP_DIR/.${FINAL}.partial"
  if [[ -n "${BACKUP_GPG_PUBLIC_KEY_FILE:-}" ]]; then
    gpg --batch --quiet --import "$BACKUP_GPG_PUBLIC_KEY_FILE"
  fi
  gpg --batch --yes --quiet --trust-model always --recipient "$GPG_RECIPIENT" \
    --output "$ENC_PARTIAL" --encrypt "$PARTIAL"
  log "encrypted with gpg"
fi

if [[ -n "$ENC_PARTIAL" ]]; then
  rm -f -- "$PARTIAL"
  PARTIAL=""
  mv -- "$ENC_PARTIAL" "$BACKUP_DIR/$FINAL"
  ENC_PARTIAL=""
else
  mv -- "$PARTIAL" "$BACKUP_DIR/$FINAL"
  PARTIAL=""
fi

(cd "$BACKUP_DIR" && sha256sum -- "$FINAL" >"$FINAL.sha256")
SIZE_FINAL="$(wc -c <"$BACKUP_DIR/$FINAL" | tr -d ' ')"
log "wrote $FINAL (${SIZE_FINAL} bytes, dump ${SIZE_PLAIN} bytes) + checksum"

prune_local

if [[ -n "$BACKUP_S3_URI" ]]; then
  log "uploading to $(s3_base)/"
  s3_put "$BACKUP_DIR/$FINAL" "$FINAL"
  s3_put "$BACKUP_DIR/$FINAL.sha256" "$FINAL.sha256"
  prune_remote
fi

NOW="$(date -u +%s)"
printf '%s\n' "$NOW" >"$LAST_SUCCESS_FILE"
write_metrics "$NOW" "$SIZE_FINAL" || warn "could not write $METRICS_FILE"
log "backup OK: $FINAL"

if [[ -n "${BACKUP_HEARTBEAT_URL:-}" ]] && command -v curl >/dev/null 2>&1; then
  curl -fsS -m 15 -o /dev/null "$BACKUP_HEARTBEAT_URL" || warn "heartbeat ping failed"
fi
