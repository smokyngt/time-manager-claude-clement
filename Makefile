COMPOSE     := docker compose
COMPOSE_DEV := docker compose -f docker-compose.dev.yml
COMPOSE_OBS := $(COMPOSE) -f docker-compose.yml -f docker-compose.observability.yml
COMPOSE_BAK := $(COMPOSE) -f docker-compose.yml -f docker-compose.backup.yml

.DEFAULT_GOAL := help
.PHONY: help dev up down logs migrate seed demo rotate-keys purge-sessions \
        obs-up obs-down backup-up backup-now backup-verify load-smoke load load-stress load-spike load-soak docs ci

help: ## List targets
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-15s %s\n", $$1, $$2}'

dev: ## Start the dev stack with hot reload
	$(COMPOSE_DEV) up --build

up: ## Start the production stack (requires .env)
	$(COMPOSE) up --build -d

down: ## Stop production and dev stacks
	$(COMPOSE) down
	$(COMPOSE_DEV) down

logs: ## Tail production stack logs
	$(COMPOSE) logs -f --tail=100

migrate: ## Run database migrations (prod stack; also automatic on api start)
	$(COMPOSE) run --rm --no-deps api bun run db:migrate:prod

seed: ## Seed the admin user (prod stack; also automatic on api start)
	$(COMPOSE) run --rm --no-deps api bun run db:seed:prod

demo: ## Load demo data (dev stack must be running: make dev)
	$(COMPOSE_DEV) exec api bun run db:seed:demo

rotate-keys: ## Re-encrypt data with the current ENCRYPTION_KEY (see Operations, Key rotation in the internal docs)
	$(COMPOSE) run --rm --no-deps api bun run db:rotate:prod

purge-sessions: ## Delete expired/revoked refresh tokens (prod stack)
	$(COMPOSE) run --rm --no-deps api bun run db:purge:prod

obs-up: ## Start the prod stack with Grafana/Prometheus/Tempo/Loki (requires METRICS_TOKEN)
	$(COMPOSE_OBS) up --build -d

obs-down: ## Stop the prod stack and the observability services
	$(COMPOSE_OBS) down

backup-up: ## Start the prod stack with scheduled PostgreSQL backups
	$(COMPOSE_BAK) up --build -d

backup-now: ## Run one backup immediately (backup overlay must be running)
	$(COMPOSE_BAK) exec backup backup.sh

backup-verify: ## Restore the latest backup into a scratch database and check it
	$(COMPOSE_BAK) --profile tools run --rm restore verify.sh

load-smoke: ## k6 smoke test (BASE_URL=http://localhost:8000 by default)
	k6 run -e BASE_URL=$${BASE_URL:-http://localhost:8000} ops/load/smoke.js

load: ## k6 load test, 50 virtual users
	k6 run -e BASE_URL=$${BASE_URL:-http://localhost:8000} ops/load/load.js

load-stress: ## k6 stress test
	k6 run -e BASE_URL=$${BASE_URL:-http://localhost:8000} ops/load/stress.js

load-spike: ## k6 spike test
	k6 run -e BASE_URL=$${BASE_URL:-http://localhost:8000} ops/load/spike.js

load-soak: ## k6 soak test, 30 minutes
	k6 run -e BASE_URL=$${BASE_URL:-http://localhost:8000} ops/load/soak.js

docs: ## Build the three docs sites (openapi, typedocs, public)
	cd docs/openapi && bun install --frozen-lockfile && bun run build
	cd docs/typedocs && bun install --frozen-lockfile && bun run build
	cd docs/public && bun install --frozen-lockfile && bun run build

ci: ## Run the same checks as CI locally
	cd api && bun install --frozen-lockfile && bun run typecheck && bun run lint && bun run test:unit && bun run openapi:generate
	cd sdks/typescript && bun install --frozen-lockfile && bun run typecheck && bun run lint && bun run test && bun run build
	cd web && bun install --frozen-lockfile && bun run typecheck && bun run lint && bun run test:unit && bun run build
	docker build -f api/Dockerfile.prod --target runtime -t time-manager-api:ci api
	docker build -f web/Dockerfile.prod -t time-manager-web:ci .
