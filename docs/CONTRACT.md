# Monorepo contract

Shared conventions between `api/`, `web/` and the DevOps files. Every package follows them.

## Layout

```
api/                 Bun + Fastify 5 + TypeScript + Drizzle (PostgreSQL)
web/                 React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui
docker-compose.yml   production stack (docker compose up)
docker-compose.dev.yml  development stack (hot reload)
.github/workflows/   CI
docs/                project documentation
```

## Package manager

Bun everywhere (`bun install`, `bun.lock` committed). Each package has its own `package.json`; there is no root workspace.

## Scripts (identical names in api/ and web/)

| Script | api | web |
|---|---|---|
| `dev` | watch mode server | vite dev server |
| `build` | `bun build` to `dist/` | `vite build` to `dist/` |
| `start` | run `dist/` | – |
| `typecheck` | `tsc --noEmit` | `tsc -b --noEmit` |
| `lint` | eslint | eslint |
| `test:unit` | `bun test tests/unit` | `vitest run` |
| `openapi:generate` | writes `api/openapi.json` | – |
| `api:types` | – | generates `src/lib/api/schema.d.ts` from `../api/openapi.json` |
| `db:generate` / `db:migrate` | drizzle-kit | – |

## Ports and URLs

- API listens on `PORT` (default `8000`), routes under `/v1`, docs UI at `/docs`, JSON spec at `/docs/json`, health at `GET /health`.
- Web dev server on `5173`; production web is static files served by nginx on port `80` (published as `8080`), which proxies `/v1` and `/docs` to the `api` service.
- PostgreSQL 17 on `5432`, compose service name `db`.

## Environment variables (api)

```
NODE_ENV, PORT, LOG_LEVEL
DATABASE_URL=postgres://timemanager:timemanager@db:5432/timemanager
JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_TTL=15m, JWT_REFRESH_TTL=7d
CORS_ORIGIN=http://localhost:5173
WEB_URL=http://localhost:5173
MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID=common, MICROSOFT_REDIRECT_URI=http://localhost:8000/v1/auth/microsoft/callback
SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
```

Environment variables (web, build time): `VITE_API_URL` (empty string = same origin).

## Auth model

- Access token: short-lived JWT returned in the JSON body, kept in memory by the web client, sent as `Authorization: Bearer`.
- Refresh token: opaque random token, stored hashed in the `refresh_tokens` table, sent as an `httpOnly`, `Secure` (prod), `SameSite=Lax` cookie `tm_refresh` scoped to path `/v1/auth`. Rotated on every refresh; reuse revokes the family.
- Endpoints: `POST /v1/auth/login`, `POST /v1/auth/refresh`, `POST /v1/auth/logout`, `GET /v1/auth/me`, `GET /v1/auth/microsoft`, `GET /v1/auth/microsoft/callback`.
- No public signup. Users are created by a manager/admin through `POST /v1/users/new`.
- Roles: `employee`, `manager`, `admin`.

## Wire format

snake_case JSON on the wire and in the database. Success envelope `{ data, event }`; error envelope `{ code, message, status, request_id }`.
