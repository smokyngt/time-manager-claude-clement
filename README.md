# Time Manager

Time Manager is a workforce time-tracking application. **Employees** clock in and out and review their hours; **managers** organise teams and follow KPIs (worked hours, lateness, attendance) for the people they manage.

## Stack

| Layer | Technology |
|---|---|
| Web | React 19, Vite, TypeScript, Tailwind v4, shadcn/ui |
| API | Bun, Fastify 5, TypeScript, Drizzle ORM, OpenAPI at `/docs` |
| Database | PostgreSQL 17 |
| Serving | nginx 1.27 (static SPA + reverse proxy) |
| Tooling | Bun, Docker Compose, GitHub Actions |

## Architecture

```mermaid
flowchart LR
    Browser --> Nginx["web (nginx :80 -> :8080)"]
    Nginx -- "static SPA" --> Browser
    Nginx -- "/v1, /docs" --> API["api (Fastify :8000)"]
    API --> DB[("db (PostgreSQL :5432)")]
```

Only `web` is published in production; `api` and `db` live on an internal Docker network.

## Quickstart

### Production stack

```bash
cp .env.example .env     # then replace every CHANGE_ME value
docker compose up --build
```

Open http://localhost:8080 (API docs: http://localhost:8080/docs). Migrations run automatically through the one-shot `migrate` service before the API starts. Create the first admin with `make seed`.

### Development stack (hot reload)

```bash
docker compose -f docker-compose.dev.yml up --build   # or: make dev
```

Web on http://localhost:5173, API on http://localhost:8000, PostgreSQL on `localhost:5432`.

### Make targets

`make dev`, `make up`, `make down`, `make logs`, `make migrate`, `make seed`, `make ci` (runs the CI checks locally).

## Documentation

- [api/README.md](api/README.md)
- [web/README.md](web/README.md)
- [docs/CONTRACT.md](docs/CONTRACT.md): shared conventions (scripts, ports, env vars, auth, wire format)

## Continuous integration

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests (superseded PR runs are cancelled):

1. **api**: install (frozen lockfile), typecheck, lint, unit tests, OpenAPI generation, with a PostgreSQL service container available.
2. **web**: install (frozen lockfile), typecheck, lint, unit tests, build.
3. **docker**: once both pass, builds the production images with Buildx and GitHub Actions cache (no push).
