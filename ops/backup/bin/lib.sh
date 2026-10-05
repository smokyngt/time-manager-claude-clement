#!/usr/bin/env bash
# Shared helpers for the backup scripts. Meant to be sourced, never executed.
# shellcheck shell=bash

SCRIPT_NAME="${SCRIPT_NAME:-$(basename "${0:-backup}")}"

log() { printf '%s [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SCRIPT_NAME" "$*"; }
warn() { log "WARN: $*" >&2; }
err() { log "ERROR: $*" >&2; }
die() {
  err "$*"
  exit 1
}

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_PREFIX="${BACKUP_PREFIX:-}"
BACKUP_KEEP_DAILY="${BACKUP_KEEP_DAILY:-7}"
BACKUP_KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-4}"
BACKUP_KEEP_MONTHLY="${BACKUP_KEEP_MONTHLY:-6}"
BACKUP_S3_URI="${BACKUP_S3_URI:-}"
BACKUP_S3_ENDPOINT_URL="${BACKUP_S3_ENDPOINT_URL:-}"
BACKUP_AGE_IDENTITY_FILE="${BACKUP_AGE_IDENTITY_FILE:-}"
# shellcheck disable=SC2034 # used by backup.sh and healthcheck.sh
LAST_SUCCESS_FILE="${BACKUP_LAST_SUCCESS_FILE:-$BACKUP_DIR/last-success}"
METRICS_FILE="${BACKUP_METRICS_FILE:-$BACKUP_DIR/metrics.prom}"

require_cmds() {
  local c
  for c in "$@"; do
    command -v "$c" >/dev/null 2>&1 || die "required command not found: $c"
  done
}

require_uint() { # name value
  [[ "$2" =~ ^[0-9]+$ ]] || die "$1 must be a non-negative integer (got '$2')"
}

# Credentials only ever travel through PG* environment variables (or ~/.pgpass),
# never through argv, so they cannot leak via `ps` or logs.

pct_decode() { # percent-decode $1
  local s="${1//\\/\\\\}"
  printf '%b' "${s//%/\\x}"
}

# apply_pg_url URL: export PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE from a URL.
apply_pg_url() {
  local url="$1"
  local re='^postgres(ql)?://(([^:@/]*)(:([^@]*))?@)?([^:/?]*)(:([0-9]+))?(/([^?]*))?(\?(.*))?$'
  [[ "$url" =~ $re ]] || die "not a valid postgres:// URL (value hidden)"
  local user="${BASH_REMATCH[3]}" pass="${BASH_REMATCH[5]}" host="${BASH_REMATCH[6]}"
  local port="${BASH_REMATCH[8]}" db="${BASH_REMATCH[10]}" query="${BASH_REMATCH[12]}"
  [[ -n "$db" ]] || die "database URL has no database name"
  export PGHOST="$host" PGPORT="${port:-5432}" PGDATABASE
  PGDATABASE="$(pct_decode "$db")"
  if [[ -n "$user" ]]; then export PGUSER; PGUSER="$(pct_decode "$user")"; else unset PGUSER; fi
  if [[ -n "$pass" ]]; then export PGPASSWORD; PGPASSWORD="$(pct_decode "$pass")"; else unset PGPASSWORD; fi
  unset PGSSLMODE
  if [[ "$query" =~ (^|&)sslmode=([a-z-]+) ]]; then export PGSSLMODE="${BASH_REMATCH[2]}"; fi
}

# use_source_conn: connection to the production database, from (first match)
# BACKUP_DATABASE_URL, DATABASE_URL, PG* variables, POSTGRES_* variables.
use_source_conn() {
  local url="${BACKUP_DATABASE_URL:-${DATABASE_URL:-}}"
  if [[ -n "$url" ]]; then
    apply_pg_url "$url"
  else
    export PGHOST="${PGHOST:-db}" PGPORT="${PGPORT:-5432}"
    export PGUSER="${PGUSER:-${POSTGRES_USER:-}}"
    export PGDATABASE="${PGDATABASE:-${POSTGRES_DB:-}}"
    if [[ -z "${PGPASSWORD:-}" && -n "${POSTGRES_PASSWORD:-}" ]]; then export PGPASSWORD="$POSTGRES_PASSWORD"; fi
  fi
  [[ -n "${PGDATABASE:-}" ]] || die "no source database configured (set DATABASE_URL or POSTGRES_DB)"
  [[ -n "${PGUSER:-}" ]] || die "no database user configured (set DATABASE_URL or POSTGRES_USER)"
}

# conn_id: stable identity of the current PG* target, "host:port/db".
conn_id() { printf '%s:%s/%s' "${PGHOST:-local}" "${PGPORT:-5432}" "${PGDATABASE:-}"; }

backup_prefix() { printf '%s' "${BACKUP_PREFIX:-${PGDATABASE:-backup}}"; }

# is_dump_name NAME: true for backup artifacts (not checksum or temp files).
is_dump_name() {
  [[ "$1" =~ ^[A-Za-z0-9_.-]+_[0-9]{8}T[0-9]{6}Z\.dump(\.age|\.gpg)?$ ]]
}

list_local_dumps() { # newest first
  local f n
  [[ -d "$BACKUP_DIR" ]] || return 0
  for f in "$BACKUP_DIR"/*; do
    [[ -f "$f" ]] || continue
    n="$(basename "$f")"
    if is_dump_name "$n" && [[ "$n" == "$(backup_prefix)_"* ]]; then printf '%s\n' "$n"; fi
  done | sort -r
}

# prune_candidates: reads backup names on stdin, prints the names that fall
# outside the daily/weekly/monthly retention window.
#  - daily:   newest backup of each of the last N distinct days
#  - weekly:  newest backup of each of the last N distinct weeks (Monday based)
#  - monthly: newest backup of each of the last N distinct months
# The newest backup is always kept. Names without a timestamp are never listed.
prune_candidates() {
  sort -r | awk -v kd="$BACKUP_KEEP_DAILY" -v kw="$BACKUP_KEEP_WEEKLY" -v km="$BACKUP_KEEP_MONTHLY" '
    function days_from_civil(y, m, d,    era, yoe, doy, doe) {
      if (m <= 2) y -= 1
      era = int(y / 400)
      yoe = y - era * 400
      doy = int((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
      doe = yoe * 365 + int(yoe / 4) - int(yoe / 100) + doy
      return era * 146097 + doe - 719468
    }
    {
      names[NR] = $0
      if (match($0, /[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z/)) {
        ts = substr($0, RSTART, 8)
        y = substr(ts, 1, 4) + 0; mo = substr(ts, 5, 2) + 0; d = substr(ts, 7, 2) + 0
        day[NR] = ts
        month[NR] = substr(ts, 1, 6)
        week[NR] = int((days_from_civil(y, mo, d) + 3) / 7)
        valid[NR] = 1
      }
    }
    END {
      for (i = 1; i <= NR; i++) {
        if (!valid[i]) continue
        keep = 0
        if (!(day[i] in sd) && nd < kd) { sd[day[i]] = 1; nd++; keep = 1 }
        if (!(week[i] in sw) && nw < kw) { sw[week[i]] = 1; nw++; keep = 1 }
        if (!(month[i] in sm) && nm < km) { sm[month[i]] = 1; nm++; keep = 1 }
        if (!keep) print names[i]
      }
    }'
}

prune_local() {
  local name
  while IFS= read -r name; do
    [[ -n "$name" ]] || continue
    log "retention: removing local $name"
    rm -f -- "$BACKUP_DIR/$name" "$BACKUP_DIR/$name.sha256"
  done < <(list_local_dumps | prune_candidates)
}

s3_base() { printf '%s' "${BACKUP_S3_URI%/}"; }

s3_client() {
  case "${BACKUP_S3_CLIENT:-auto}" in
    aws | rclone) printf '%s' "$BACKUP_S3_CLIENT" ;;
    auto)
      if command -v aws >/dev/null 2>&1; then printf aws
      elif command -v rclone >/dev/null 2>&1; then printf rclone
      else die "BACKUP_S3_URI is set but neither aws nor rclone is installed"
      fi
      ;;
    *) die "BACKUP_S3_CLIENT must be aws, rclone or auto" ;;
  esac
}

# s3_path [NAME]: remote location of NAME (or of the prefix itself) for the client.
s3_path() {
  local name="${1:-}" rest="${BACKUP_S3_URI#s3://}"
  rest="${rest%/}"
  if [[ "$(s3_client)" == aws ]]; then
    printf 's3://%s%s' "$rest" "${name:+/$name}"
  else
    local backend=":s3,env_auth=true"
    if [[ -n "$BACKUP_S3_ENDPOINT_URL" ]]; then backend+=",provider=Other,endpoint=\"$BACKUP_S3_ENDPOINT_URL\""; fi
    printf '%s:%s%s' "$backend" "$rest" "${name:+/$name}"
  fi
}

s3_put() { # LOCAL_FILE NAME
  if [[ "$(s3_client)" == aws ]]; then
    local ep=()
    [[ -z "$BACKUP_S3_ENDPOINT_URL" ]] || ep=(--endpoint-url "$BACKUP_S3_ENDPOINT_URL")
    aws "${ep[@]}" s3 cp "$1" "$(s3_path "$2")" --only-show-errors
  else
    rclone copyto "$1" "$(s3_path "$2")"
  fi
}

s3_get() { # NAME LOCAL_FILE
  if [[ "$(s3_client)" == aws ]]; then
    local ep=()
    [[ -z "$BACKUP_S3_ENDPOINT_URL" ]] || ep=(--endpoint-url "$BACKUP_S3_ENDPOINT_URL")
    aws "${ep[@]}" s3 cp "$(s3_path "$1")" "$2" --only-show-errors
  else
    rclone copyto "$(s3_path "$1")" "$2"
  fi
}

s3_rm() { # NAME
  if [[ "$(s3_client)" == aws ]]; then
    local ep=()
    [[ -z "$BACKUP_S3_ENDPOINT_URL" ]] || ep=(--endpoint-url "$BACKUP_S3_ENDPOINT_URL")
    aws "${ep[@]}" s3 rm "$(s3_path "$1")" --only-show-errors
  else
    rclone deletefile "$(s3_path "$1")"
  fi
}

s3_names() {
  if [[ "$(s3_client)" == aws ]]; then
    local ep=()
    [[ -z "$BACKUP_S3_ENDPOINT_URL" ]] || ep=(--endpoint-url "$BACKUP_S3_ENDPOINT_URL")
    aws "${ep[@]}" s3 ls "$(s3_path)/" | awk '{print $NF}'
  else
    rclone lsf --files-only "$(s3_path)/"
  fi
}

s3_list_dumps() { # newest first
  local name
  s3_names | while IFS= read -r name; do
    if is_dump_name "$name" && [[ "$name" == "$(backup_prefix)_"* ]]; then printf '%s\n' "$name"; fi
  done | sort -r
}

prune_remote() {
  local name listing
  listing="$(s3_list_dumps)"
  while IFS= read -r name; do
    [[ -n "$name" ]] || continue
    log "retention: removing remote $name"
    s3_rm "$name"
    s3_rm "$name.sha256" || true
  done < <(printf '%s\n' "$listing" | prune_candidates)
}

# verify_checksum FILE: FILE.sha256 must exist and match.
verify_checksum() {
  local f="$1"
  [[ -f "$f.sha256" ]] || die "missing checksum file $(basename "$f").sha256"
  local expected actual
  expected="$(awk '{print $1; exit}' "$f.sha256")"
  actual="$(sha256sum "$f" | awk '{print $1}')"
  [[ -n "$expected" && "$expected" == "$actual" ]] || die "checksum mismatch for $(basename "$f")"
  log "checksum OK for $(basename "$f")"
}

# stream_dump FILE: write the plain (decrypted) custom-format dump to stdout.
stream_dump() {
  case "$1" in
    *.age)
      require_cmds age
      [[ -n "$BACKUP_AGE_IDENTITY_FILE" && -r "$BACKUP_AGE_IDENTITY_FILE" ]] ||
        die "encrypted with age: set BACKUP_AGE_IDENTITY_FILE to a readable identity file"
      age --decrypt -i "$BACKUP_AGE_IDENTITY_FILE" -- "$1"
      ;;
    *.gpg)
      require_cmds gpg
      gpg --batch --quiet --decrypt -- "$1"
      ;;
    *) cat -- "$1" ;;
  esac
}

# resolve_backup WHAT REMOTE: set FILE to a local path of the backup named WHAT
# ("latest" or a name/path). With REMOTE=true it is downloaded from S3 into
# TMP_DIR (the caller removes it). BACKUP_PREFIX must already be set.
TMP_DIR=""
FILE=""
resolve_backup() {
  local what="$1" remote="$2"
  if [[ "$remote" == true ]]; then
    [[ -n "$BACKUP_S3_URI" ]] || die "--remote needs BACKUP_S3_URI"
    s3_client >/dev/null
    TMP_DIR="$(mktemp -d)"
    if [[ "$what" == "latest" ]]; then
      what="$(s3_list_dumps | sed -n 1p)"
      [[ -n "$what" ]] || die "no backup found at $(s3_base)/"
    fi
    what="$(basename "$what")"
    log "downloading $what from $(s3_base)/"
    s3_get "$what" "$TMP_DIR/$what"
    s3_get "$what.sha256" "$TMP_DIR/$what.sha256" || warn "no remote checksum file"
    FILE="$TMP_DIR/$what"
  else
    if [[ "$what" == "latest" ]]; then
      what="$(list_local_dumps | sed -n 1p)"
      [[ -n "$what" ]] || die "no backup found in $BACKUP_DIR"
    fi
    if [[ -f "$what" ]]; then FILE="$what"; else FILE="$BACKUP_DIR/$what"; fi
    [[ -f "$FILE" ]] || die "backup not found: $what"
  fi
}

# restore_into FILE: restore FILE into the database addressed by PG* variables.
restore_into() {
  local f="$1"
  require_cmds pg_restore
  log "restoring $(basename "$f") into $(conn_id)"
  stream_dump "$f" | pg_restore --clean --if-exists --no-owner \
    --single-transaction --exit-on-error --dbname "$PGDATABASE"
}

# admin_db: database used to issue CREATE/DROP DATABASE.
admin_db() { printf '%s' "${BACKUP_ADMIN_DB:-postgres}"; }

# quote_ident NAME: SQL-quote an identifier.
quote_ident() { printf '"%s"' "${1//\"/\"\"}"; }

json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/ }"
  printf '%s' "$s"
}

notify_failure() { # message
  [[ -n "${BACKUP_ALERT_WEBHOOK:-}" ]] || return 0
  command -v curl >/dev/null 2>&1 || { warn "curl missing, cannot send alert"; return 0; }
  local msg
  msg="$(json_escape "$1")"
  curl -fsS -m 15 -H 'Content-Type: application/json' \
    -d "{\"text\":\"$msg\",\"content\":\"$msg\"}" "$BACKUP_ALERT_WEBHOOK" >/dev/null 2>&1 ||
    warn "failed to deliver alert webhook"
}

# write_metrics TIMESTAMP SIZE_BYTES: atomically rewrite the Prometheus text file.
# Empty arguments write the metadata only (no sample yet).
write_metrics() {
  local ts="$1" size="$2" tmp="$METRICS_FILE.tmp"
  {
    printf '# HELP tm_backup_last_success_timestamp_seconds Unix time of the last successful backup.\n'
    printf '# TYPE tm_backup_last_success_timestamp_seconds gauge\n'
    if [[ -n "$ts" ]]; then printf 'tm_backup_last_success_timestamp_seconds %s\n' "$ts"; fi
    printf '# HELP tm_backup_last_size_bytes Size in bytes of the last backup file (after encryption).\n'
    printf '# TYPE tm_backup_last_size_bytes gauge\n'
    if [[ -n "$size" ]]; then printf 'tm_backup_last_size_bytes %s\n' "$size"; fi
  } >"$tmp"
  chmod 644 "$tmp"
  mv -- "$tmp" "$METRICS_FILE"
}
