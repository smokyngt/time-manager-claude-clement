#!/usr/bin/env bash
# Invoked by crond: loads the environment captured by entrypoint.sh and runs the
# backup with output going to the container logs (PID 1).
set -euo pipefail

ENV_FILE="${BACKUP_ENV_FILE:-/run/backup.env}"
if [[ -r "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "$ENV_FILE"
  set +a
fi
exec /usr/local/bin/backup.sh "$@" >>/proc/1/fd/1 2>>/proc/1/fd/2
