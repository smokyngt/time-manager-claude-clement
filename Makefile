COMPOSE_DEV := docker compose -f docker-compose.dev.yml

.PHONY: help dev up down logs migrate seed demo ci

help: ## List targets
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

dev: ## Start the dev stack with hot reload
	$(COMPOSE_DEV) up --build

up: ## Start the production stack (requires .env)
	docker compose up --build -d

down: ## Stop production and dev stacks
	docker compose down
	$(COMPOSE_DEV) down

logs: ## Tail production stack logs
	docker compose logs -f --tail=100

migrate: ## Run database migrations (prod stack; also automatic on api start)
	docker compose run --rm --no-deps api bun run db:migrate:prod

seed: ## Seed the admin user (prod stack; also automatic on api start)
	docker compose run --rm --no-deps api bun run db:seed:prod

demo: ## Load demo data (dev stack must be running: make dev)
	$(COMPOSE_DEV) exec api bun run db:seed:demo

ci: ## Run the same checks as CI locally
	cd api && bun install --frozen-lockfile && bun run typecheck && bun run lint && bun run test:unit && bun run openapi:generate
	cd web && bun install --frozen-lockfile && bun run typecheck && bun run lint && bun run test:unit && bun run build
	docker build -f api/Dockerfile.prod --target runtime -t time-manager-api:ci api
	docker build -f web/Dockerfile.prod -t time-manager-web:ci web
