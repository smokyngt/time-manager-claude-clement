# Backup sidecar: pg_dump/pg_restore 17 (matches the db image) + busybox crond.
# Build: docker build -t time-manager-backup ops/backup
# Offsite upload uses aws-cli (default) or rclone; build with --build-arg WITH_AWS_CLI=0
# and/or --build-arg WITH_RCLONE=1 to choose.
FROM postgres:17.11-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24

ARG VERSION=0.0.0
ARG REVISION=unknown
ARG SOURCE=https://github.com/smokyngt/time-manager-claude-clement
LABEL org.opencontainers.image.title="time-manager-backup" \
      org.opencontainers.image.description="PostgreSQL backup sidecar" \
      org.opencontainers.image.source="${SOURCE}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.version="${VERSION}"

ARG WITH_AWS_CLI=1
ARG WITH_RCLONE=0

# hadolint ignore=DL3018
RUN apk add --no-cache bash curl tzdata age gnupg \
    && if [ "$WITH_AWS_CLI" = "1" ]; then apk add --no-cache aws-cli; fi \
    && if [ "$WITH_RCLONE" = "1" ]; then apk add --no-cache rclone; fi \
    && mkdir -p /backups

COPY --chown=0:0 --chmod=0755 bin/ /usr/local/bin/

EXPOSE 9187

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
