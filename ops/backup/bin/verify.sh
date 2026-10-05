#!/usr/bin/env bash
# Restore a backup into a throwaway database and run sanity queries, then drop it.
#
# Usage: verify.sh [FILE|latest] [--remote]
#
# The scratch database is created on the same server as the source database
# (or on VERIFY_ADMIN_URL, a postgres:// URL of a server where the role may
# CREATE DATABASE). It is dropped on exit, success or failure.
#   VERIFY_REQUIRED_TABLES  tables that must exist
#                           (default: users teams team_members clocks refresh_tokens audit_logs)
#   VERIFY_NONEMPTY_TABLES  tables that must contain rows (default: users)
set -euo pipefail
umask 077

SCRIPT_NAME="verify.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh source-path=SCRIPTDIR
. "$SCRIPT_DIR/lib.sh"

WHAT="latest"
REMOTE=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote) REMOTE=true; shift ;;
    -h | --help)
      sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*) die "unknown option: $1" ;;
    *) WHAT="$1"; shift ;;
  esac
done

SCRATCH=""
drop_scratch() {
  if [[ -n "$SCRATCH" ]]; then
    PGDATABASE="$(admin_db)" psql -XAtq -c "DROP DATABASE IF EXISTS $(quote_ident "$SCRATCH") WITH (FORCE)" >/dev/null 2>&1 ||
      warn "could not drop scratch database $SCRATCH, drop it manually"
    SCRATCH=""
  fi
}
on_exit() {
  local rc=$?
  drop_scratch
  [[ -z "$TMP_DIR" ]] || rm -rf -- "$TMP_DIR"
  if [[ $rc -ne 0 ]]; then
    err "verification FAILED (exit $rc)"
    notify_failure "Time Manager backup VERIFICATION FAILED on $(hostname) at $(date -u +%Y-%m-%dT%H:%M:%SZ)."
  fi
}
trap on_exit EXIT

require_cmds psql pg_restore sha256sum

use_source_conn
BACKUP_PREFIX="$(backup_prefix)"
resolve_backup "$WHAT" "$REMOTE"
verify_checksum "$FILE"

if [[ -n "${VERIFY_ADMIN_URL:-}" ]]; then apply_pg_url "$VERIFY_ADMIN_URL"; fi
SCRATCH="tm_verify_$(date +%s)_$$"
log "creating scratch database $SCRATCH on $(conn_id)"
PGDATABASE="$(admin_db)" psql -XAtq -v ON_ERROR_STOP=1 -c "CREATE DATABASE $(quote_ident "$SCRATCH")"
export PGDATABASE="$SCRATCH"

restore_into "$FILE"

required="${VERIFY_REQUIRED_TABLES:-users teams team_members clocks refresh_tokens audit_logs}"
nonempty="${VERIFY_NONEMPTY_TABLES:-users}"
failed=0

for t in $required; do
  [[ "$t" =~ ^[a-z_][a-z0-9_]*$ ]] || die "invalid table name in VERIFY_REQUIRED_TABLES: $t"
  present="$(psql -XAtq -v ON_ERROR_STOP=1 -c "SELECT to_regclass('public.$t') IS NOT NULL")"
  if [[ "$present" != "t" ]]; then
    err "table public.$t is missing"
    failed=1
    continue
  fi
  count="$(psql -XAtq -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.$t")"
  log "table public.$t: $count rows"
done

for t in $nonempty; do
  [[ "$t" =~ ^[a-z_][a-z0-9_]*$ ]] || die "invalid table name in VERIFY_NONEMPTY_TABLES: $t"
  count="$(psql -XAtq -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.$t" 2>/dev/null || echo 0)"
  if [[ "$count" -le 0 ]]; then
    err "table public.$t is empty or unreadable"
    failed=1
  fi
done

[[ $failed -eq 0 ]] || die "sanity checks failed for $(basename "$FILE")"
log "verification OK: $(basename "$FILE")"
