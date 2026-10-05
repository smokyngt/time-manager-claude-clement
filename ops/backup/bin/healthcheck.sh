#!/usr/bin/env bash
# Container HEALTHCHECK: healthy when the last successful backup is younger than
# BACKUP_MAX_AGE_HOURS (default 26). Before the first success, the container gets
# the same grace period counted from its start.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
LAST_SUCCESS_FILE="${BACKUP_LAST_SUCCESS_FILE:-$BACKUP_DIR/last-success}"
STARTED_FILE="${BACKUP_STARTED_FILE:-/run/backup.started}"
max_age=$((${BACKUP_MAX_AGE_HOURS:-26} * 3600))
now="$(date +%s)"

if [[ -s "$LAST_SUCCESS_FILE" ]]; then
  ref="$(cat "$LAST_SUCCESS_FILE")"
  what="last backup"
elif [[ -s "$STARTED_FILE" ]]; then
  ref="$(cat "$STARTED_FILE")"
  what="container start (no backup yet)"
else
  echo "unhealthy: no last-success and no start marker" >&2
  exit 1
fi

[[ "$ref" =~ ^[0-9]+$ ]] || { echo "unhealthy: unreadable timestamp" >&2; exit 1; }
age=$((now - ref))
if [[ $age -gt $max_age ]]; then
  echo "unhealthy: $what is $((age / 3600))h old (limit $((max_age / 3600))h)" >&2
  exit 1
fi
echo "healthy: $what $((age / 60)) min ago"
