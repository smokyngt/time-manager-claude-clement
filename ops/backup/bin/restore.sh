#!/usr/bin/env bash
# Restore a backup into a target database with checksum verification.
#
# Usage: restore.sh [FILE|latest] [--target URL] [--remote] [--create] [--force]
#                   [--skip-checksum]
#
#   FILE          backup file name (looked up in BACKUP_DIR) or path; default "latest"
#   --target URL  postgres:// URL to restore into (or RESTORE_DATABASE_URL).
#                 Without it, the production database is the target.
#   --remote      fetch FILE / the latest backup from BACKUP_S3_URI first
#   --create      create the target database if it does not exist
#   --force       allow restoring over the production database
#   --skip-checksum  do not require a .sha256 file (not recommended)
#
# Encrypted backups need BACKUP_AGE_IDENTITY_FILE (age) or the gpg secret key.
# Restore is a single transaction using pg_restore --clean --if-exists --no-owner.
set -euo pipefail
umask 077

SCRIPT_NAME="restore.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

WHAT="latest"
TARGET_URL="${RESTORE_DATABASE_URL:-}"
REMOTE=false
CREATE=false
FORCE=false
SKIP_CHECKSUM=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      [[ $# -ge 2 ]] || die "--target needs a URL"
      TARGET_URL="$2"
      shift 2
      ;;
    --remote) REMOTE=true; shift ;;
    --create) CREATE=true; shift ;;
    --force) FORCE=true; shift ;;
    --skip-checksum) SKIP_CHECKSUM=true; shift ;;
    -h | --help)
      sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*) die "unknown option: $1" ;;
    *) WHAT="$1"; shift ;;
  esac
done

cleanup() { [[ -z "$TMP_DIR" ]] || rm -rf -- "$TMP_DIR"; }
trap cleanup EXIT

require_cmds pg_restore psql sha256sum

# Production identity first, then switch PG* to the target.
use_source_conn
PROD_ID="$(conn_id)"
BACKUP_PREFIX="$(backup_prefix)" # file names follow the source db, not the target
if [[ -n "$TARGET_URL" ]]; then
  apply_pg_url "$TARGET_URL"
fi
TARGET_ID="$(conn_id)"

if [[ "$TARGET_ID" == "$PROD_ID" ]] && ! $FORCE; then
  die "refusing to restore over the production database ($PROD_ID). Pass --target <other db> or --force."
fi
if $FORCE && [[ "$TARGET_ID" == "$PROD_ID" ]]; then
  warn "--force: restoring over PRODUCTION ($TARGET_ID). Make sure the API is stopped."
fi

resolve_backup "$WHAT" "$REMOTE"

if $SKIP_CHECKSUM; then
  warn "checksum verification skipped"
else
  verify_checksum "$FILE"
fi

if $CREATE; then
  DB="$PGDATABASE"
  exists="$(PGDATABASE="$(admin_db)" psql -XAtq -v ON_ERROR_STOP=1 -v db="$DB" \
    <<<"SELECT 1 FROM pg_database WHERE datname = :'db'")"
  if [[ "$exists" != "1" ]]; then
    log "creating database $DB"
    PGDATABASE="$(admin_db)" psql -XAtq -v ON_ERROR_STOP=1 -c "CREATE DATABASE $(quote_ident "$DB")"
  fi
fi

restore_into "$FILE"
log "restore OK into $TARGET_ID"
