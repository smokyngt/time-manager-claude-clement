#!/usr/bin/env bash
# Shared helpers. Source it; do not execute it.

export VAULT_ADDR="${VAULT_ADDR:-https://vault:8200}"
INIT_FILE="${INIT_FILE:-/vault/root/init.json}"
TOKEN_FILE="${TOKEN_FILE:-/vault/init/app-token}"
POLICY_DIR="${POLICY_DIR:-/vault/policies}"
KEY_DOMAINS="${KEY_DOMAINS:-pii content hash}"

die() {
  printf '[VAULT] error: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '[VAULT] %s\n' "$*" >&2
}

need() {
  local tool
  for tool in "$@"; do
    command -v "$tool" >/dev/null 2>&1 || die "$tool is required"
  done
}

reachable() {
  local code=0
  vault status >/dev/null 2>&1 || code=$?
  [ "$code" -ne 1 ]
}

wait_for_vault() {
  for _ in $(seq 1 "${VAULT_WAIT_ATTEMPTS:-60}"); do
    if reachable; then
      return 0
    fi
    sleep 1
  done
  die "vault is not reachable at $VAULT_ADDR"
}

status_field() {
  local filter="$1" status
  status="$(vault status -format=json 2>/dev/null || true)"
  [ -n "$status" ] || die "cannot read vault status"
  jq -r "$filter" <<<"$status"
}
