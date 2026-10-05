FROM hashicorp/vault:1.18.3
RUN apk add --no-cache bash curl jq openssl
COPY bin /vault/bin
COPY policies /vault/policies
ENTRYPOINT []
CMD ["/vault/bin/init.sh"]
