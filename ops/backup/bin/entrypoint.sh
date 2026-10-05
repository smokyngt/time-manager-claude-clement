#!/usr/bin/env bash
# Installs the crontab from BACKUP_SCHEDULE (default "15 2 * * *") and runs crond
# in the foreground. Any arguments are executed instead (e.g. restore.sh ...).
set -euo pipefail
umask 077

if [[ $# -gt 0 ]]; then
  exec "$@"
fi

SCHEDULE="${BACKUP_SCHEDULE:-15 2 * * *}"
CRON_FIELD='[0-9*/,-]+|[A-Za-z]{3}(-[A-Za-z]{3})?'
if ! [[ "$SCHEDULE" =~ ^[[:space:]]*(${CRON_FIELD})([[:space:]]+(${CRON_FIELD})){4}[[:space:]]*$ ]]; then
  echo "ERROR: BACKUP_SCHEDULE must be a 5-field cron expression (got '$SCHEDULE')" >&2
  exit 1
fi

ENV_FILE="${BACKUP_ENV_FILE:-/run/backup.env}"
STARTED_FILE="${BACKUP_STARTED_FILE:-/run/backup.started}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
mkdir -p "$BACKUP_DIR" "$(dirname "$ENV_FILE")"

# crond starts jobs with an empty environment: persist ours (root-only file).
export -p | grep -E '^declare -x (PG|POSTGRES_|DATABASE_URL|BACKUP_|AWS_|TZ=|VERIFY_|AGE_)' >"$ENV_FILE" || true
chmod 600 "$ENV_FILE"
date +%s >"$STARTED_FILE"

mkdir -p /etc/crontabs
printf '%s /usr/local/bin/cron-run.sh\n' "$SCHEDULE" >/etc/crontabs/root
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [entrypoint] backup schedule: '$SCHEDULE' (TZ=${TZ:-UTC}), dir=$BACKUP_DIR"

if [[ "${BACKUP_RUN_ON_START:-false}" == "true" ]]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [entrypoint] BACKUP_RUN_ON_START=true, running one backup now"
  /usr/local/bin/backup.sh || echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [entrypoint] initial backup failed, continuing with schedule" >&2
fi

exec crond -f -l 8 -L /dev/stdout
