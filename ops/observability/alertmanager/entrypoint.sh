#!/bin/sh
# Picks the null-receiver config unless ALERT_WEBHOOK_URL is set.
set -eu

CONFIG=/etc/alertmanager/alertmanager.yml
if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
  umask 077
  printf '%s' "${ALERT_WEBHOOK_URL}" > /tmp/alert-webhook-url
  CONFIG=/etc/alertmanager/alertmanager.webhook.yml
fi

exec /bin/alertmanager \
  --config.file="${CONFIG}" \
  --storage.path=/alertmanager \
  --data.retention=120h \
  --web.listen-address=0.0.0.0:9093
