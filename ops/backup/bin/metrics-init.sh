#!/usr/bin/env bash
# Create BACKUP_DIR/metrics.prom from the last-success marker and the newest backup
# if it does not exist yet, so the metrics endpoint is valid right after a restart.
set -euo pipefail

SCRIPT_NAME="metrics-init.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh source-path=SCRIPTDIR
. "$SCRIPT_DIR/lib.sh"

[[ ! -s "$METRICS_FILE" ]] || exit 0
ts=""
size=""
if [[ -s "$LAST_SUCCESS_FILE" ]]; then
  ts="$(cat "$LAST_SUCCESS_FILE")"
  newest="$(list_local_dumps | sed -n 1p)"
  [[ -z "$newest" ]] || size="$(wc -c <"$BACKUP_DIR/$newest" | tr -d ' ')"
fi
write_metrics "$ts" "$size"
