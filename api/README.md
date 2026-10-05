# Time Manager API

Bun + Fastify 5 + TypeScript + Drizzle (PostgreSQL 17). Conventions shared with the web app live in `../docs/CONTRACT.md`.

## Setup

```sh
cp .env.example .env
docker run -d --name tm-pg -e POSTGRES_USER=timemanager -e POSTGRES_PASSWORD=timemanager \
  -e POSTGRES_DB=timemanager -p 5432:5432 postgres:17-alpine
bun install
bun run db:migrate
bun run db:seed        # creates the admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
bun run dev            # http://localhost:8000, docs at /docs
```

## Scripts

| Script | Purpose |
|---|---|
| `dev` | watch mode server |
| `build` | bundles `src/server.ts`, `src/db/migrate.ts`, `src/db/seed.ts` into `dist/` |
| `start` | `bun dist/server.js` |
| `typecheck` / `lint` / `test:unit` | `tsc --noEmit` / eslint (zero warnings) / `bun test tests/unit` |
| `openapi:generate` | builds the app without a database and writes `openapi.json` |
| `db:generate` | drizzle-kit: new migration in `drizzle/` after a schema change |
| `db:migrate` / `db:seed` | run from sources |
| `db:migrate:prod` / `db:seed:prod` | run from `dist/` (migrations are read from `MIGRATIONS_DIR`, default `drizzle`, relative to the working directory) |

## Architecture

One request goes through five layers, one file per operation.

```
src/
  routes/<entity>/*.ts        HTTP contract: path, method, scopes, JSON schemas, OpenAPI metadata
  controllers/<entity>/*.ts   input, authorization, calls services, replies with Reply.send
  services/<entity>/*.ts      business logic and persistence, no Fastify types
  db/schema/<entity>.ts       Drizzle tables and indexes (barrel: db/schema/index.ts)
  schemas/<entity>.ts         JSON Schemas: bodies, params, entity, envelopes, errors
  lib/errors/domains/*.ts     typed errors (registerError)
  lib/events/domains/*.ts     typed success events (registerEvent)
  types/entities/*.ts         entity types
  utils/                      Access, Cursor, Reply, RateLimit, Password, ...
  plugins/auth.ts             auth({ scopes }) preHandler
  config/                     Config.store, roles and scopes
  app.ts / server.ts          app factory and entry point
```

Errors are `{ code, message, status, request_id }`, successes `{ data, event }`.

## Add a resource by mirroring `user`

1. `types/entities/<entity>.ts` and `db/schema/<entity>.ts`, export it from `db/schema/index.ts`, then `bun run db:generate`.
2. `schemas/<entity>.ts`: entity schema (description and example on every property), input schemas with `additionalProperties: false`, and a `Responses` map built with `ReplyEnvelopeSchema` and `errorResponse`.
3. `lib/errors/domains/<entity>.ts` and `lib/events/domains/<entity>.ts`.
4. `services/<entity>/<op>.ts` plus `index.ts` (Params/Response types, `XServiceType`, `XService`, `xService`). Take one params object, return one named object, wrap in try/catch and rethrow the domain error with `cause` and `metadata.route`. Call `logService.create` after every mutation.
5. `controllers/<entity>/<op>.ts` plus `index.ts`: authorize first with `Access`, then call services, then `Reply.send`.
6. `routes/<entity>/<op>.ts` plus `index.ts` with `RateLimit.options('<entity>')`; export the router from `routes/index.ts` and mount it in `app.ts` under `/v1/<entities>` with its OpenAPI tag.
7. Add scopes in `config/auth/scopes.ts` and map them to roles in `config/auth/roles.ts`.
8. Tests in `tests/unit/services/<entity>/` and `tests/unit/controllers/<entity>/` using `tests/helpers`.
9. `bun run typecheck && bun run lint && bun run test:unit && bun run openapi:generate`.

## Notes

- Refresh tokens are opaque, stored as HMAC-SHA256 hashes and rotated on every use; replaying a rotated token revokes the whole family.
- Microsoft sign-in links to existing users only (by `oid`, then by email). Set `MICROSOFT_TENANT_ID` to your own tenant rather than `common` so the email claim cannot come from an arbitrary tenant. Without `MICROSOFT_CLIENT_ID` the routes answer 503.
- `TRUST_PROXY=true` (default) is meant for deployment behind nginx, so rate limiting sees the client IP.
- Manager scope is currently "all employees"; narrow it in `utils/access.ts` once teams constrain it.
