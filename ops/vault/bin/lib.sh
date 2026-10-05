#!/usr/bin/env bash
# Shared helpers for the Vault bootstrap scripts. Source it; do not execute it.
#
# Environment:
#   VAULT_ADDR   server address (default http://127.0.0.1:8200)
#   VAULT_BIN    vault command, may contain arguments, for example:
#                "docker compose -f docker-compose.yml -f docker-compose.vault.yml exec -T -e VAULT_TOKEN vault vault"
#   VAULT_TOKEN  token used by the scripts (otherwise root_token of --init-file)
#   VAULT_CACERT CA bundle for a TLS listener

VAULT_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_OPS_DIR="$(cd "$VAULT_LIB_DIR/.." && pwd)"
REPO_ROOT="$(cd "$VAULT_OPS_DIR/../.." && pwd)"
export VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
read -r -a VAULT_CMD <<<"${VAULT_BIN:-vault}"

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '%s\n' "$*" >&2
}

need() {
  local tool
  for tool in "$@"; do
    command -v "$tool" >/dev/null 2>&1 || die "$tool is required"
  done
}

vault() {
  command "${VAULT_CMD[@]}" "$@"
}

inside_repo() {
  local target resolved
  target="$(realpath -m -- "$1")"
  resolved="$(realpath -m -- "$REPO_ROOT")"
  case "$target/" in
    "$resolved"/*) return 0 ;;
    *) return 1 ;;
  esac
}

token_from() {
  local file="${1:-}"
  if [ -n "${VAULT_TOKEN:-}" ]; then
    return 0
  fi
  [ -n "$file" ] || die "set VAULT_TOKEN or pass --init-file"
  [ -r "$file" ] || die "cannot read $file"
  VAULT_TOKEN="$(jq -er '.root_token' "$file")" || die "no root_token in $file"
  export VAULT_TOKEN
}

require_unsealed() {
  local status
  status="$(vault status -format=json 2>/dev/null || true)"
  [ -n "$status" ] || die "cannot reach vault at $VAULT_ADDR"
  [ "$(jq -r '.initialized' <<<"$status")" = "true" ] || die "vault is not initialized (run init.sh)"
  [ "$(jq -r '.sealed' <<<"$status")" = "false" ] || die "vault is sealed (run unseal.sh)"
}

subnet_of() {
  local container="$1" network
  need docker
  network="$(docker inspect -f '{{range $name, $net := .NetworkSettings.Networks}}{{$net.NetworkID}} {{end}}' "$container" | awk '{print $1}')"
  [ -n "$network" ] || die "container $container has no network"
  docker network inspect -f '{{range .IPAM.Config}}{{.Subnet}},{{end}}' "$network" | sed 's/,$//'
}
