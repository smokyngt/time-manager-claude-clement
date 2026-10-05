# Backup sidecar: pg_dump/pg_restore 17 (matches the db image) + busybox crond.
# Build: docker build -t time-manager-backup ops/backup
# Offsite upload needs aws-cli; build with --build-arg WITH_AWS_CLI=0 to leave it out.
FROM postgres:17-alpine

ARG WITH_AWS_CLI=1

# hadolint ignore=DL3018
RUN apk add --no-cache bash curl tzdata age gnupg \
    && if [ "$WITH_AWS_CLI" = "1" ]; then apk add --no-cache aws-cli; fi \
    && mkdir -p /backups

COPY bin/ /usr/local/bin/
RUN chmod 0755 /usr/local/bin/*.sh

ENV BACKUP_DIR=/backups \
    BACKUP_SCHEDULE="15 2 * * *" \
    BACKUP_KEEP_DAILY=7 \
    BACKUP_KEEP_WEEKLY=4 \
    BACKUP_KEEP_MONTHLY=6 \
    BACKUP_AGE_IDENTITY_FILE=/run/age-identity

WORKDIR /backups

HEALTHCHECK --interval=5m --timeout=10s --start-period=1m --retries=1 \
    CMD ["/usr/local/bin/healthcheck.sh"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
