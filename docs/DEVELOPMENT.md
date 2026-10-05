# Development guide

How to run, test, extend and troubleshoot the Time Manager monorepo. Shared conventions are in [CONTRACT.md](CONTRACT.md); the binding code rules are in [API_CONVENTIONS.md](API_CONVENTIONS.md).

## 1. Local setup

### Prerequisites

- [Bun](https://bun.sh) 1.3.x (CI pins `1.3.x`; the Docker images use `oven/bun:1.3`).
- PostgreSQL 17 (a Docker container is the easiest way) or Docker with Compose.
- Git. Node.js is not required.

### Run everything in Docker (fastest)

```bash
docker compose -f docker-compose.dev.yml up --build     # or: make dev
```

Web at http://localhost:5173, API at http://localhost:8000 (docs at `/docs`), PostgreSQL on `localhost:5432`. The API container runs migrations, then starts in watch mode. Dev defaults (database credentials, throwaway JWT secrets, seed admin `admin@example.com` / `admin-password-dev`) are baked into `docker-compose.dev.yml`, so no `.env` is needed.

### Run API and web on the host

1. Start PostgreSQL:

   ```bash
   docker run -d --name tm-pg -e POSTGRES_USER=timemanager -e POSTGRES_PASSWORD=timemanager \
     -e POSTGRES_DB=timemanager -p 5432:5432 postgres:17-alpine
   ```

2. API:

   ```bash
   cd api
   cp .env.example .env        # DATABASE_URL already points at localhost:5432
   bun install
   bun run db:migrate
   bun run db:seed             # admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
   bun run dev                 # http://localhost:8000, docs at /docs
   ```

3. Web (second terminal):

   ```bash
   cd web
   cp .env.example .env        # VITE_API_URL empty = same origin through the Vite proxy
   bun install
   bun run dev                 # http://localhost:5173, proxies /v1 and /docs to :8000
   ```

4. Sign in with the seeded admin, then create employees and managers from the Users page.

### Environment variables

| Where | File | Notes |
|---|---|---|
| API (host) | `api/.env` from `api/.env.example` | Read from `process.env`; Bun loads `.env` automatically |
| Production compose | `.env` at the repo root from `.env.example` | Replace every `CHANGE_ME` |
| Web | `web/.env` | Only `VITE_API_URL` (build time; empty = same origin) |

Main API variables (defaults in [CONTRACT.md](CONTRACT.md)): `NODE_ENV`, `PORT`, `LOG_LEVEL`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `CORS_ORIGIN`, `WEB_URL`, `MICROSOFT_*`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`. Optional tuning: `TRUST_PROXY` (default `true`), `MIGRATIONS_DIR` (default `drizzle`), `APP_TIMEZONE` (default `Europe/Paris`, used by reports), `<ENTITY>_RATE_LIMIT_MAX` and `<ENTITY>_RATE_LIMIT_WINDOW`, `AUTH_LOGIN_RATE_LIMIT_MAX` and `_WINDOW`.

`.env` files are git-ignored (only `.env.example` is committed). Never commit real secrets; see [AUTH.md](AUTH.md#4-secrets-handling). In production the API refuses to start unless both JWT secrets have at least 32 characters and `DATABASE_URL` is set.

## 2. Docker usage

| Stack | File | Command | Purpose |
|---|---|---|---|
| Development | `docker-compose.dev.yml` | `make dev` | Hot reload. Source is bind-mounted; `node_modules` stays in an anonymous volume. Web and API ports published; db published on 5432 |
| Production | `docker-compose.yml` | `cp .env.example .env && docker compose up --build` (or `make up`) | Only `web` (nginx) is published, on `8080`. `api` and `db` are on the internal `backend` network |

Production services: `db` (postgres:17-alpine, volume `db-data`, healthcheck), `api` (runs `db:migrate:prod` and `db:seed:prod` on startup from the same runtime image, then serves; healthcheck from the Dockerfile polls `GET /health`; single replica only), `web` (nginx serving the SPA and proxying `/v1` and `/docs`). Open http://localhost:8080. The admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` is created automatically on startup (idempotent); `make migrate` and `make seed` re-run the steps manually.

Make targets: `dev`, `up`, `down`, `logs`, `migrate`, `seed`, `demo` (loads demo data into the dev stack), `ci` (runs the CI checks locally, including the production image builds).

Notes:

- `VITE_API_URL` is a build argument of the web image. Leave it empty in production so the browser calls the same origin and nginx proxies to the API (this is also what makes the `tm_refresh` cookie first-party).
- Set `CORS_ORIGIN`, `WEB_URL` and `MICROSOFT_REDIRECT_URI` to the public URL of the stack when it is not `localhost:8080`.
- Reset the development database with `docker compose -f docker-compose.dev.yml down -v`.

## 3. Scripts reference

### `api/`

| Script | What it does |
|---|---|
| `dev` | `bun --watch src/server.ts` |
| `build` | Bundles `src/server.ts`, `src/db/migrate.ts`, `src/db/seed.ts` into `dist/` |
| `start` | `bun dist/server.js` |
| `typecheck` | `tsc --noEmit` |
| `lint` | `eslint . --max-warnings=0` |
| `test:unit` | `bun test tests/unit` |
| `openapi:generate` | Builds the app without a database and writes `api/openapi.json` |
| `db:generate` | `drizzle-kit generate`: creates a migration in `api/drizzle/` after a schema change |
| `db:migrate`, `db:seed` | Run from sources (`src/db/*.ts`) |
| `db:seed:demo` | Loads demo data (`src/db/demo.ts`) |
| `db:migrate:prod`, `db:seed:prod` | Run from `dist/` (migrations read from `MIGRATIONS_DIR`, default `drizzle`, relative to the working directory) |

### `web/`

| Script | What it does |
|---|---|
| `dev` | Vite dev server on 5173; proxies `/v1` and `/docs` to `VITE_PROXY_TARGET` (default `http://localhost:8000`) |
| `build` | `tsc -b && vite build` to `dist/` |
| `preview` | Serves the production build locally |
| `typecheck` | `tsc -b --noEmit` |
| `lint` | `eslint . --max-warnings 0` |
| `format` | Prettier write |
| `test:unit` | `vitest run` (jsdom, Testing Library) |
| `api:types` | `openapi-typescript ../api/openapi.json -o src/lib/api/schema.d.ts` |

## 4. Add a new API resource (mirror `user`)

`user` is the reference implementation. Read all its files first and copy the shape; do not invent new patterns. Replace `<entity>` with the singular name (`team`), `<entities>` with the plural.

Checklist:

1. **Entity type**: `src/types/entities/<entity>.ts` (sorted keys, `object: '<entity>'`, `created_at`, `updated_at`, `archived_at` when archivable).
2. **Table**: `src/db/schema/<entity>.ts` with uuid `id`, bigint timestamps, indexes (including `(created_at, id)` for cursor pagination). Export it from `src/db/schema/index.ts`, then run `bun run db:generate` and commit the SQL in `api/drizzle/`.
3. **Schemas**: `src/schemas/<entity>.ts`. Entity schema (`additionalProperties: false`, `description` and `example` on every property), body and params schemas with bounds and `additionalProperties: false`, reuse `schemas/common.ts`, a `Responses` map built with the envelope helper and one error schema per code.
4. **Errors and events**: `src/lib/errors/domains/<entity>.ts` (`<ENTITY>_NOT_FOUND` 404, `<ENTITY>_CONFLICT` 409 if relevant, `<ENTITY>_<OP>_ERROR` 500) and `src/lib/events/domains/<entity>.ts` (`<entity>.created`, `<entities>.listed`, ...).
5. **Mapper**: `src/utils/<entity>-mapper.ts` to turn rows into entities. Never return raw rows.
6. **Services**: `src/services/<entity>/<op>.ts` for `create`, `list`, `retrieve`, `update`, `archive`, `restore`, `delete`, plus `index.ts` (Params/Response types, `<Entity>ServiceType`, class, `<entity>Service` singleton). One params object in, one named object out; wrap in `try/catch` and rethrow the domain error with `cause` and `metadata.route`; call `logService.create` after each mutation; `list` uses `Cursor.paginate`.
7. **Access rules**: add an `Access.<entity>` helper in `src/utils/access/<entity>.ts` if rules go beyond role checks (see `access/team.ts`, `access/clock.ts`), and expose it from `utils/access.ts`.
8. **Controllers**: `src/controllers/<entity>/<op>.ts` plus `index.ts`. Get the caller with `Access.context(req)`, authorize before calling services, respond only with `Reply.send`. Bulk endpoints dedupe ids with `Set`, cap the count, check every item first, run with `Promise.all`, return `{ success, updated|deleted, failed }`.
9. **Routes**: `src/routes/<entity>/<op>.ts` with `preHandler: auth({ scopes })` and a full schema (`summary`, `tags`, `security`, responses per status), plus `index.ts` that registers `rateLimit` with `RateLimit.options('<entity>')`. Export the router from `src/routes/index.ts`.
10. **Mount**: in `src/app.ts` add `app.register(<entity>Router, { prefix: '/v1/<entities>' })` and add the tag to the OpenAPI `tags` list.
11. **Scopes**: add `<entities>:read` / `:write` / `:manage` to `src/config/auth/scopes.ts` (alphabetical) and grant them per role in `src/config/auth/roles.ts`. Update [ROLES.md](ROLES.md).
12. **Tests**: `tests/unit/services/<entity>/<op>.test.ts` for each operation and `tests/unit/controllers/<entity>/` for authorization and bulk logic.
13. **Verify** from `api/`: `bun run typecheck && bun run lint && bun run test:unit && bun run openapi:generate`. Zero warnings; the generated spec must list the tag and every endpoint.
14. **Web** (if it has a UI): `bun run api:types` in `web/`, then add `features/<entities>/{api,hooks,components,pages}` and a route in `src/routes.tsx` (wrap in `RoleRoute` if restricted).

Style reminders enforced by lint: alphabetical ordering everywhere (`eslint-plugin-perfectionist`), explicit `.js` import extensions and `@/` aliases, JSDoc block with `@route`, `@param`, `@returns`, `@throws` on every exported handler, service operation and util method, and no other comments.

## 5. Testing strategy

| Level | Tooling | Scope | Status |
|---|---|---|---|
| Unit (API) | `bun:test`, `tests/helpers/fake-db.ts` | Every service operation (happy path, not found, forbidden, error wrapping with `cause`, audit log call), controllers (authorization, bulk logic), utils (`Access`, `Cursor`, KPI), error handler, app smoke (`app.inject` on `/health` and auth enforcement) | In place; no database needed |
| Unit (web) | Vitest, Testing Library, jsdom | Auth session/refresh logic (`auth-fetch`, `session`), route guards, forms and utilities | In place |
| Integration (API + PostgreSQL) | `bun test tests/integration` against a real database | Migrations apply, constraints (unique open clock, cascades, partial indexes), report SQL aggregation | Present in `api/tests/integration/` (`auth`, `users`). CI applies migrations to its PostgreSQL service (`timemanager_test`) and runs the folder when it exists (no npm script yet) |
| End-to-end | Playwright (`@playwright/test`, specs in `web/e2e/`) | Login, navigation and role-restricted routes; later clock in/out and team reports | Present (`auth.spec.ts`, `navigation.spec.ts`). CI runs it in a dedicated job when `web/e2e/` exists |

Conventions for API unit tests (from [API_CONVENTIONS.md](API_CONVENTIONS.md)): snapshot modules before mocking and restore them in `afterAll`; import the unit under test dynamically after mocking; call `mock.clearAllMocks()` in `afterEach`.

Run one file: `cd api && bun test tests/unit/services/user/create.test.ts`. Web: `cd web && bunx vitest run src/lib/api/auth-fetch.test.ts`.

## 6. CI pipeline

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests. Concurrency cancels superseded runs on a PR. Permissions are read-only (`contents: read`).

1. **api** (15 min timeout, working dir `api`, PostgreSQL 17 service container): Bun 1.3.x, cached `~/.bun/install/cache` keyed on `bun.lock`, `bun install --frozen-lockfile`, `typecheck`, `lint`, `test:unit`, apply migrations, integration tests (if `api/tests/integration/` exists), `openapi:generate`. Uses throwaway JWT secrets and a test `DATABASE_URL`.
2. **web** (15 min, working dir `web`): same setup, then `typecheck`, `lint`, `test:unit`, `build`.
3. **e2e**: starts the migrated and seeded API and runs Playwright (chromium) when `web/e2e/` exists; uploads the report.
4. **docker** (20 min, after the other jobs pass): Buildx with GitHub Actions cache; builds the API and web production images. Nothing is pushed.

The release, CodeQL, dependency review, secret scan, nightly and PR-title workflows are described in [CI_CD.md](CI_CD.md).

Run the same checks locally with `make ci`.

## 7. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `invalid configuration: JWT_ACCESS_SECRET must be at least 32 characters` | `NODE_ENV=production` with short or missing secrets. Generate with `openssl rand -hex 32` |
| `error: ... is required` from `docker compose` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `JWT_*_SECRET` are required in `.env` for the production stack |
| `ECONNREFUSED 5432` / API cannot connect | PostgreSQL is not running or `DATABASE_URL` host is wrong. On the host use `localhost`, in compose use `db` |
| `relation "users" does not exist` | Migrations not applied: `bun run db:migrate` (or `make migrate`) |
| Teams, clocks or reports tables missing | The committed migration `0000_init.sql` predates those tables; run `bun run db:generate` and commit the new migration |
| Seed prints `SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required` | Set both variables. The seed is idempotent (`admin already exists`) |
| Login works but every page returns to `/login` after reload | The `tm_refresh` cookie is not sent. Check `CORS_ORIGIN` equals the SPA origin exactly, `VITE_API_URL` is empty (same origin), and in production you use HTTPS or `localhost` (the cookie is `Secure` when `NODE_ENV=production`) |
| `429 RATE_LIMITED` while developing | Raise `AUTH_LOGIN_RATE_LIMIT_MAX` (default 10 per minute per IP) or `<ENTITY>_RATE_LIMIT_MAX` in `.env` |
| All users share one rate-limit bucket | Behind a proxy without `TRUST_PROXY=true`, every request appears to come from the proxy IP |
| Microsoft button returns `503` | `MICROSOFT_CLIENT_ID` or `MICROSOFT_CLIENT_SECRET` not set. See [AUTH.md](AUTH.md#5-register-the-azure-microsoft-entra-id-application) |
| Microsoft sign-in ends on `?error=AUTH_MICROSOFT_UNKNOWN_USER` | No user with that email exists; a manager or admin must create it first (no auto-signup) |
| `AADSTS50011` redirect URI mismatch | `MICROSOFT_REDIRECT_URI` must equal the Azure registration character for character |
| `lint` fails on ordering | `perfectionist` requires alphabetical keys, members, imports. Run `bunx eslint . --fix` in the package |
| `web` types do not know a new endpoint | Run `bun run openapi:generate` in `api/` then `bun run api:types` in `web/` |
| Hot reload does not pick up changes in the dev container | `CHOKIDAR_USEPOLLING=true` is set for web; on the API side confirm the bind mount `./api:/app` exists and rebuild with `--build` after dependency changes |
| Port already in use | Another process uses 5173, 8000, 8080 or 5432; stop it or change the published port in the compose file |
| Stale dependencies after switching branches | Run `bun install` in the package; CI uses `--frozen-lockfile`, so commit `bun.lock` with dependency changes |
