# API engineering brief

Binding rules for every resource in `api/`. **`user` is the reference implementation.** Read every `user` file before writing code and mirror it. When this brief and the `user` code disagree, the code wins, and the disagreement must be reported.

This brief is the Prosperify API brief adapted to Time Manager:

| Prosperify | Time Manager | Why |
|---|---|---|
| MongoDB + Mongoose, `models/org/<entity>.ts` | PostgreSQL + Drizzle, `db/schema/<entity>.ts` | The subject requires a relational database and an ORM |
| Mongo duplicate key `11000` → `409 duplicate.key` | Postgres unique violation `23505` → `409 duplicate.key` | Same contract |
| CSFLE plugin (`mongoCsfle`) | `Cipher` (AES-256-GCM) + `Digest` (HMAC-SHA256) columns | Field-level encryption of user text, hash columns for lookups |
| Organizations, stores (`organization_id`, `Access.store.*`) | One company; visibility by role and team membership (`Access.user.*`, `Access.team.*`, `Access.clock.*`) | Time Manager has no tenants |
| `vaultConfig.store.*` | `Config.store.*` | No vault in this project |

---

## 1. Stack

| Concern | Choice |
|---|---|
| Runtime | Bun, ESM |
| Language | TypeScript strict, `.js` import extensions, `@/` aliases |
| HTTP | Fastify 5: plugin encapsulation, typed route generics, JSON Schema for validation, serialization and OpenAPI |
| Persistence | PostgreSQL + Drizzle; uuid ids, epoch-millisecond `bigint` timestamps |
| AuthN/Z | Bearer JWT, `auth({ scopes })` preHandler, `Access` util |
| Errors | Registered error factories + one global error handler |
| Events | Registered event factories, in the response envelope and the audit log |
| Observability | Request id → `correlation_id`, pino structured logs, Prometheus metrics, optional OpenTelemetry |
| Tests | `bun:test`; integration tests with `app.inject` against a real Postgres |
| Lint | ESLint 9: `perfectionist`, `jsdoc`, `import-x`, `unused-imports`, Prettier |

## 2. Architecture

```
HTTP request
  └─ routes/<entity>/<op>.ts         contract: method, path, scopes, JSON schemas, OpenAPI
      └─ controllers/<entity>/<op>.ts  identity, visibility, permissions, orchestration, reply
          └─ services/<entity>/<op>.ts   business rules + persistence (no Fastify types)
              └─ db/schema/<entity>.ts     Drizzle table, indexes, constraints
```

Supporting modules:

```
types/entities/<entity>.ts        entity type
schemas/<entity>.ts               JSON Schemas: entity, bodies, params, responses, errors
lib/errors/domains/<entity>.ts    error factories (code + default status)
lib/events/domains/<entity>.ts    event factories (code + typed payload)
utils/mappers/<entity>.ts         row → entity (decrypts, computes derived fields)
```

Infrastructure locations:

```
lib/errors/base/registry.ts   registerError, AppError
lib/events/base/registry.ts   registerEvent
middlewares/auth/index.ts     auth({ scopes }) preHandler
middlewares/error.ts          global error handler
utils/http/reply.ts           Reply.send
utils/http/cursor.ts          Cursor.paginate
utils/http/rate-limit.ts      RateLimit.error, RateLimit.key
utils/auth/authz.ts           Access
utils/crypto/cipher.ts        Cipher.seal / Cipher.open
utils/crypto/digest.ts        Digest.hash
utils/http/sanitizer.ts       Sanitizer.body
types/misc/reply.ts           ReplyEnvelope, ErrorEnvelope
tests/support/                fake.ts (Fake.request / Fake.reply), loose.ts, prehandler.ts, db.ts
```

Layer rules:
- **Route**: no logic; declares the contract and hands off to the controller.
- **Controller**: the only layer that reads `req`. Resolves the caller, enforces visibility and permissions, calls services, replies through `Reply.send`. Never touches the database.
- **Service**: one params object in, one named object out. No `FastifyRequest`, no reply, no permission logic beyond the visibility filter passed in. Callable from controllers, jobs, scripts and other services.
- **Schema (db)**: data shape, indexes, constraints only.

Each operation (`create`, `list`, `retrieve`, `update`, `archive`, `restore`, `delete`) has its own file in each layer, plus an `index.ts` per folder that holds the types and the class grouping the operations. All cross-module imports go through barrels (`@/lib/errors/index.js`, `@/lib/events/index.js`, `@/services/index.js`, `@/controllers/index.js`, `@/schemas/index.js`, `@/types/entities/index.js`, `@/db/schema/index.js`).

## 3. Fastify patterns

### 3.1 App-level setup (`src/app.ts`, done once)

- Ajv: `allErrors: true`, `coerceTypes: true`, `removeAdditional: true`, keyword `example`. Unknown fields are stripped silently, so `additionalProperties: false` on every input schema is what protects the handler.
- `genReqId`: honours a valid `x-request-id` (≤128 chars, `[A-Za-z0-9_-]`), else `crypto.randomUUID()`. `req.id` is echoed as `x-request-id` and becomes `correlation_id` in every success and error body.
- Hooks, in order:
  - `onRequest`: child logger (ip, method, request_id, trace id, redacted url) stored in `requestContext`.
  - `preValidation`: rejects JSON deeper than `JSON_BODY_MAX_DEPTH` (default 10) with `ValidationError`, sanitizes JSON bodies with `Sanitizer.body` (trims strings, strips control characters, drops `__proto__`/`constructor`/`prototype` keys).
  - `preHandler` (route-level): `auth(...)` authenticates and stores `user` and `scopes` in `requestContext`.
  - `onResponse`: request metrics.
- `@fastify/request-context` is the per-request store. Read the caller with `Access.context(req)`.
- `setErrorHandler(ErrorHandler.handle)` is the only place that turns a thrown value into an HTTP error response.
- Helmet, CORS, cookies and Swagger are registered once on the app.

### 3.2 One plugin per route

Each route file exports a `FastifyPluginAsync` that registers exactly one route. The resource's `index.ts` plugin registers a scoped rate limit and then each operation.

### 3.3 Typed generics

```ts
fastify.post<{ Body: CreateTeamBody; Reply: ReplyEnvelope<CreateTeamResponse> }>(...)
```

The controller signature repeats the same types.

### 3.4 Schema-first contracts

- `body` / `params` validate input; failures never reach the controller and return `400 validation.error` with `errors: [{ code, path, params }]`.
- `response` serializes output: only declared fields are sent, so hash and secret columns can never leak. Entity schemas use `additionalProperties: false` and list every public field.
- Every status a handler can produce is declared (200, 400, 401, 403/404/409 where relevant, 429, 500), each as `{ content: { 'application/json': { schema } }, description }`.

### 3.5 Auth on the route, authorization in the controller

- `preHandler: auth({ scopes: ['teams:manage'] })` is the coarse gate: valid token, active user, scope held. `scopes: []` means authenticated with no specific scope.
- The controller checks the resource itself through `Access` (`Access.user.require`, `Access.team.require`, `Access.clock.require`, `Access.role.require`).

### 3.6 Uniform replies

Handlers never call `reply.send` directly. They `await Reply.send(req, reply, event, data)`:

```json
{
  "data": { "team": { "id": "…", "object": "team" } },
  "event": {
    "code": "team.created",
    "correlation_id": "<req.id>",
    "metadata": {},
    "payload": { "actor": "…", "team_id": "…" }
  },
  "timestamp": 1760000000000
}
```

`data` is always a named object: `{ team }`, `{ items, more, next, total }`, `{ success, updated, failed }`, `{ clock }`.

## 4. Errors

### 4.1 Factories

`registerError({ code, defaultStatus })` returns a factory. Codes are dotted lowercase: `<entity>.<action>.failed`, `<entity>.not.found`, `<entity>.conflict`. Registering the same code twice with a different status throws at boot.

```ts
throw TeamNotFoundError({ metadata: { team_id: id } });
throw TeamCreateError({ cause: error, metadata: { route: 'team.service.create' } });
```

Factory options: `cause`, `metadata`, `status`, `message`, `correlation_id`, `instance`, `retry_after`, `mergeCauseMetadata`.

Core errors: `ValidationError` (`validation.error`, 400), `InvalidJsonError` (`json.invalid`, 400), `TokenAuthenticationError` (`token.authentication.failed`, 401), `UnauthorizedError` (`unauthorized`, 403), `NotFoundError` (`route.not.found`, 404), `DuplicateKeyError` (`duplicate.key`, 409), `RateLimitError` (`rate.limit.exceeded`, 429), `InternalError` (`internal.unexpected`, 500).

### 4.2 Wrapping rule

Every controller and service body is wrapped:

```ts
try {
  ...
} catch (error) {
  throw TeamCreateError({ cause: error, metadata: { route: 'team.controller.create' } });
}
```

- Cause already an `AppError` and no `status`/`message`/`correlation_id` passed → the factory returns the cause unchanged (a 404 stays a 404).
- Cause a plain `Error` → new `AppError` with the wrapper's code and default status, original kept as `cause`, metadata merged and JSON-sanitized.

### 4.3 Global error handler (`middlewares/error.ts`)

| Thrown | Response |
|---|---|
| Ajv validation failure | `400 validation.error` with `errors[]` (`{ code, path, params }`, params snake_case) |
| JSON `SyntaxError` | `400 json.invalid` |
| Postgres `23505` | `409 duplicate.key` |
| `AppError` | its own code and status |
| Object whose `code` is registered | that code, with the object's status or the registered default |
| Anything else | `500 internal.unexpected` |

Problem body:

```json
{
  "code": "team.not.found",
  "correlation_id": "<req.id>",
  "instance": "/v1/teams/…",
  "status": 404,
  "timestamp": 1760000000000
}
```

`metadata` and `stack` only outside production. Logs `warn` for 4xx and `error` for 5xx with the flattened cause chain; increments the error metric. `retry_after` sets the `Retry-After` header.

### 4.4 Rules

- Never `throw new Error()` in request code; never `reply.code(4xx).send()` by hand.
- Metadata holds ids, counts, reasons and the route. Never names, notes, emails, tokens.
- Visibility-scoped lookups make out-of-scope ids look like `<entity>.not.found` (404). `UnauthorizedError` (403) is for "visible but not allowed".
- Declare an error response schema for every error status, using the factory's `.code` / `.defaultStatus` as `const`.
- Best-effort side effects inside a mutation are caught locally and logged with `req.log.warn` / the service logger.

## 5. Encryption of user text

- Free text supplied by users (`first_name`, `last_name`, `phone_number`, team `name` and `description`, clock `note`) is stored encrypted with `Cipher.seal` (AES-256-GCM, key `ENCRYPTION_KEY`, 32 bytes base64, versioned `v1.<iv>.<tag>.<ciphertext>`), and decrypted in the mapper with `Cipher.open`.
- Values that must be looked up or be unique get a `<field>_hash` column computed with `Digest.hash` (HMAC-SHA256, key `HASH_KEY`) on the normalized value (e.g. `email_hash` on the lowercased email). Hash columns never appear in response schemas.
- Email stays queryable only through `email_hash`; it is stored encrypted like other PII.

## 6. Conventions

### 6.1 Data and naming
- snake_case for every wire and database field; camelCase only for locals created by renaming during destructuring (`team_id: teamId`).
- Every entity has `id` (uuid), `object: '<entity>'`, `actor_id` where an actor creates it, `created_at`, `updated_at` (ms numbers), `archived_at` when archivable.
- Types are declared with `type X = { ... }`, not `interface`.
- Classes, not object literals, for services, controllers and utils; short noun classes with single-word methods.
- Named exports only; reserved words aliased (`deleteRoute`, `remove`).

### 6.2 Code style (lint-enforced)
- Alphabetical order for object keys, type members, class members, union members, variable declarations and schema properties.
- Imports in groups separated by blank lines: external → `@/` aliases → relative → `import type` last.
- Explicit `public`; explicit return types on exported functions.
- Blank line before `return` and between logical steps; guard clauses.
- No `any`; no non-null assertions unless the schema guarantees the value.
- One contract: no backward-compat shims, legacy flags, fallback branches or `a ?? b ?? c` chains.

### 6.3 JSDoc and comments

```ts
/**
 * @route <entity>.<layer>.<op>
 * @param {<Type>} <name>
 * @returns {Promise<<Type>>}
 * @throws {<ErrorA> | <ErrorB>}
 */
```

`@route` equals the `route` in error metadata; `@throws` lists every factory that can escape. No prose in JSDoc, no inline comments anywhere. User-facing documentation lives in JSON Schemas (`title`, `description`, `example`) in clear professional English.

### 6.4 Security checklist
- [ ] Every query filtered by what the actor may see.
- [ ] Every route has `auth({ scopes })` (except login, refresh, logout, Microsoft, health).
- [ ] Every resource-level action checks rights in the controller through `Access`.
- [ ] Every input schema has `additionalProperties: false`, length/format/pattern bounds, array caps.
- [ ] Free text encrypted; hash columns never in responses.
- [ ] Response schemas list only public fields.
- [ ] Logs, error metadata and event payloads contain ids and counts only.
- [ ] Bulk endpoints check every item's access before mutating any.

## 7. Routes

| Op | Method | Path | Input |
|---|---|---|---|
| create | POST | `/new` | body |
| list | POST | `/list` | body (filters + `cursor`, `limit`, `order`, `skip`, `date`, `archived`) |
| retrieve | GET | `/:id` | params |
| update | PATCH | `/` | body `{ ids, data }` |
| archive | POST | `/:id/archive` | params |
| restore | POST | `/:id/restore` | params |
| delete | DELETE | `/` | body `{ ids }` |

Router `index.ts`:

```ts
const teams: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    errorResponseBuilder: RateLimit.error,
    keyGenerator: RateLimit.key,
    max: Config.store.number('TEAM_RATE_LIMIT_MAX', 6000),
    timeWindow: Config.store.text('TEAM_RATE_LIMIT_WINDOW', '1 minute'),
  });
  await fastify.register(create);
  ...
};

export { teams };
```

`routes/index.ts`: `export { teams as teamRouter } from './team/index.js';`. `app.ts`: `app.register(teamRouter, { prefix: '/v1/teams' })` and the swagger tag.

Bulk controllers: dedupe with `[...new Set(ids)]`, reject empty or over `MAX_<ENTITIES> = 100`, retrieve and authorize every target before mutating, mutate with `Promise.all` catching per item, reply `{ success: failed.length === 0, updated|deleted, failed: [{ id, code }] }`, log counts and ids.

## 8. Tests

- `tests/unit/services/<entity>/<op>.test.ts`: snapshot the real module (`{ ...(await import(...)) }`) before `mock.module`, restore it in `afterAll`, import the unit under test after mocking, `mock.clearAllMocks()` in `afterEach`. Cover happy path, not found, error wrapping (domain code, status, `cause` kept), audit log call.
- `tests/unit/controllers/<entity>/<op>.test.ts`: replace service methods with `mock(...)` and restore them in `afterAll`; build requests with `Fake.request({ actor, body, params, scopes })` and `Fake.reply()`. Cover forbidden (403), out-of-scope (404), not found stays 404, happy path params, bulk never mutates when one item fails access.
- `tests/unit/routes/<entity>/index.test.ts`: `Prehandler.install()`, `Prehandler.allowed(route, scope)`, `Prehandler.denied(route, scope)`: mutations require the write scope, the read scope is denied for mutations.
- `tests/integration/<entity>.test.ts`: real Postgres through `Harness`.

## 9. Definition of done

From `api/`: `bun run typecheck`, `bun run lint`, `bun run test:unit`, `bun run openapi:generate` pass with no warnings; the spec shows the tag and every route with request, response and error schemas; `bun run test:integration` passes against Postgres.
