#!/usr/bin/env bash
# Generate the bootstrap CA and the Vault server certificate once.
#
# Output (TLS_DIR, default /vault/tls): ca.crt, ca.key, tls.crt, tls.key
# Existing files are kept, so re-running changes nothing. Consumers mount ca.crt
# read-only (NODE_EXTRA_CA_CERTS / VAULT_CACERT). Once pki-root and pki-internal are
# enabled the listener can move to a certificate issued by Vault.
#
# Environment:
#   TLS_DIR        output directory (default /vault/tls)
#   TLS_HOSTS      DNS names (default "vault localhost")
#   TLS_ADDRESSES  IP addresses (default "127.0.0.1")
#   TLS_DAYS       server certificate lifetime (default 825)
set -euo pipefail
umask 077

# shellcheck source=lib.sh source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

DIRECTORY="${TLS_DIR:-/vault/tls}"
HOSTS="${TLS_HOSTS:-vault localhost}"
ADDRESSES="${TLS_ADDRESSES:-127.0.0.1}"
DAYS="${TLS_DAYS:-825}"

need openssl
mkdir -p "$DIRECTORY"

if [ -s "$DIRECTORY/ca.crt" ] && [ -s "$DIRECTORY/tls.crt" ] && [ -s "$DIRECTORY/tls.key" ]; then
  log "tls material already present in $DIRECTORY"
  exit 0
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

names=""
index=0
for host in $HOSTS; do
  index=$((index + 1))
  names="${names}DNS.${index} = ${host}"$'\n'
done
index=0
for address in $ADDRESSES; do
  index=$((index + 1))
  names="${names}IP.${index} = ${address}"$'\n'
done

cat >"$work/server.cnf" <<CONF
[req]
distinguished_name = dn
prompt = no
req_extensions = ext
[dn]
CN = vault
[ext]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt
[alt]
${names}
CONF

openssl ecparam -name prime256v1 -genkey -noout -out "$work/ca.key"
openssl req -new -x509 -key "$work/ca.key" -sha256 -days 3650 -subj "/CN=Time Manager Vault Bootstrap CA" \
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" -out "$work/ca.crt"
openssl ecparam -name prime256v1 -genkey -noout -out "$work/tls.key"
openssl req -new -key "$work/tls.key" -config "$work/server.cnf" -out "$work/tls.csr"
openssl x509 -req -in "$work/tls.csr" -CA "$work/ca.crt" -CAkey "$work/ca.key" -CAcreateserial \
  -days "$DAYS" -sha256 -extfile "$work/server.cnf" -extensions ext -out "$work/tls.crt" 2>/dev/null

install -m 644 "$work/ca.crt" "$DIRECTORY/ca.crt"
install -m 644 "$work/tls.crt" "$DIRECTORY/tls.crt"
install -m 600 "$work/ca.key" "$DIRECTORY/ca.key"
install -m 644 "$work/tls.key" "$DIRECTORY/tls.key"
log "generated bootstrap CA and server certificate in $DIRECTORY"
