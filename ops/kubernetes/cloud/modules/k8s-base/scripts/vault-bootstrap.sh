#!/usr/bin/env bash
set -euo pipefail
umask 077

NAMESPACE="${VAULT_NAMESPACE:-vault}"
INIT_FILE="${VAULT_INIT_FILE:-./vault-init.local.json}"
SHARES="${VAULT_KEY_SHARES:-5}"
THRESHOLD="${VAULT_KEY_THRESHOLD:-3}"
REPLICAS="${VAULT_REPLICAS:-3}"

command -v kubectl >/dev/null || { echo "kubectl is required" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }

vault_exec() {
  local pod="$1"
  shift
  kubectl -n "$NAMESPACE" exec "$pod" -c vault -- "$@"
}

status_json() {
  vault_exec "$1" vault status -format=json 2>/dev/null || true
}

echo "[vault-bootstrap] waiting for vault-0 to run"
kubectl -n "$NAMESPACE" wait --for=jsonpath='{.status.phase}'=Running pod/vault-0 --timeout=300s

initialized="$(status_json vault-0 | jq -r '.initialized // false')"
if [[ "$initialized" != "true" ]]; then
  if [[ -e "$INIT_FILE" ]]; then
    echo "[vault-bootstrap] refusing to initialise: $INIT_FILE exists but Vault reports uninitialised" >&2
    exit 1
  fi
  echo "[vault-bootstrap] initialising ($SHARES shares, threshold $THRESHOLD)"
  vault_exec vault-0 vault operator init -key-shares="$SHARES" -key-threshold="$THRESHOLD" -format=json >"$INIT_FILE"
  chmod 600 "$INIT_FILE"
  echo "[vault-bootstrap] init material written to $INIT_FILE (mode 600); move it offline and out of the repository"
fi

[[ -s "$INIT_FILE" ]] || { echo "[vault-bootstrap] $INIT_FILE is missing: unseal with the offline key shares instead" >&2; exit 1; }

for i in $(seq 0 $((REPLICAS - 1))); do
  pod="vault-$i"
  kubectl -n "$NAMESPACE" wait --for=jsonpath='{.status.phase}'=Running "pod/$pod" --timeout=300s
  for n in $(seq 0 $((THRESHOLD - 1))); do
    sealed="$(status_json "$pod" | jq -r '.sealed // true')"
    [[ "$sealed" == "true" ]] || break
    key="$(jq -r ".unseal_keys_b64[$n]" "$INIT_FILE")"
    vault_exec "$pod" vault operator unseal "$key" >/dev/null
  done
  echo "[vault-bootstrap] $pod sealed=$(status_json "$pod" | jq -r '.sealed')"
done

echo "[vault-bootstrap] done. Export VAULT_TOKEN from the init file for the Terraform run, then delete it from the shell history."
