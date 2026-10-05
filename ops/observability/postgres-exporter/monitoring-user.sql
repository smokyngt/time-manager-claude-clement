-- Read-only monitoring role for postgres-exporter.
-- Run once as a superuser (the POSTGRES_USER of the stack):
--
--   docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
--     -v monitor_password="'<strong-password>'" \
--     -f - < ops/observability/postgres-exporter/monitoring-user.sql
--
-- Then set in .env (URL-encode special characters) and recreate the exporter:
--
--   PG_EXPORTER_DATA_SOURCE_NAME=postgresql://tm_monitor:<strong-password>@db:5432/<POSTGRES_DB>?sslmode=disable
--   docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d postgres-exporter
--
-- pg_monitor grants read access to pg_stat_* views and monitoring functions only:
-- no table data, no DDL, no DML.

CREATE ROLE tm_monitor WITH LOGIN PASSWORD :monitor_password NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT CONNECTION LIMIT 3;
GRANT pg_monitor TO tm_monitor;
ALTER ROLE tm_monitor SET statement_timeout = '5s';
ALTER ROLE tm_monitor SET default_transaction_read_only = on;

-- Optional (slow-query panels): requires `shared_preload_libraries = 'pg_stat_statements'`
-- on the db service and a restart, then:
--   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
-- and running postgres-exporter with `--collector.stat_statements`.
