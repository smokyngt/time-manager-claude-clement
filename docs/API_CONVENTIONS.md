# API conventions

Binding rules for every resource in `api/`. **`user` is the reference implementation**: before writing a resource, read every `user` file (route, controller, service, db schema, schemas, errors, events, entity type, tests) and mirror it. Do not invent new patterns, helpers or abstractions when an existing one already does the job.

## Stack

| Layer | Choice |
|---|---|
| Runtime | Bun, ESM (`"type": "module"`) |
| Language | TypeScript strict; imports use explicit `.js` extensions and `@/` aliases |
| HTTP | Fastify 5, schema-first: JSON Schema drives validation, serialization and OpenAPI |
| Data | PostgreSQL + Drizzle ORM; uuid `id`s, epoch-millisecond `bigint` timestamps |
| Auth | `auth({ scopes })` preHandler + `Access` util |
| Tests | `bun:test` |
| Lint | ESLint 9 + `perfectionist` (alphabetical ordering enforced), `jsdoc`, `import-x`, Prettier |

## Architecture: one request, five layers

```
routes/<entity>/*.ts      HTTP contract: path, method, auth scopes, JSON schemas, OpenAPI metadata
controllers/<entity>/*.ts request handling: read input, authz checks, call services, reply
services/<entity>/*.ts    business logic + persistence; no Fastify types
db/schema/<entity>.ts     Drizzle table, indexes
schemas/<entity>.ts       JSON Schemas (bodies, params, entity, response envelopes, error shapes)
lib/errors/domains/<entity>.ts  typed error factories (registerError)
lib/events/domains/<entity>.ts  typed success events (registerEvent<Payload>)
types/entities/<entity>.ts      the entity type
```

Each operation lives in its own file (`create.ts`, `list.ts`, `retrieve.ts`, `update.ts`, `archive.ts`, `restore.ts`, `delete.ts`).

## Layer rules

- **Entity type**: sorted keys, snake_case, `id`, `object: '<entity>'`, `created_at: number`, `updated_at: null | number`, `archived_at: null | number` when archivable.
- **Errors**: one `registerError` per failure: `<entity>.not.found` (404), `<entity>.conflict` (409) when relevant, `<entity>.<op>.failed` (500).
- **Events**: one `registerEvent<Payload>` per success (`<entity>.created`, `<entities>.listed`, ...), typed payload with ids.
- **Schemas**: entity schema with `additionalProperties: false`, every property has `description` + `example` (+ `format`). Body/params schemas with `additionalProperties: false`, `minLength`/`maxLength`/`pattern`, reuse `schemas/common.ts`. Response schemas built with the envelope helper; one error schema per error code.
- **Services**: `index.ts` declares `XParams` / `XResponse` types, `<Entity>ServiceType`, `class <Entity>Service implements ...` with assigned methods, `export const <entity>Service = new <Entity>Service()`. One params object in, one named object out (`{ team }`, `{ items, more, next, total }`, `{ success }`). `retrieve` throws `<Entity>NotFoundError`. `list` paginates with `Cursor.paginate`. Mutations write `logService.create({ actor, event, metadata })`. Body wrapped in `try/catch`, rethrow as the domain error with `cause` and `metadata: { route: '<entity>.service.<op>' }`. Return plain objects through a mapper, never raw rows.
- **Controllers**: `async (req: FastifyRequest<{ Body | Params }>, reply: FastifyReply<{ Reply: ReplyEnvelope<X> }>): Promise<void>`. Caller via `Access.context(req)`. Authorization **before** calling services. snake_case input destructured into camelCase locals. Respond only via `await Reply.send(req, reply, Event({ payload }), data)`. Same `try/catch` with `route: '<entity>.controller.<op>'`. Bulk endpoints dedupe with `new Set`, cap the count, check access for every item first, run with `Promise.all`, return `{ success, updated|deleted, failed }`.
- **Routes**: one `FastifyPluginAsync` per operation with typed generics, `preHandler: auth({ scopes })`, full `schema` (`body`/`params`, `response` per status with description, `summary`, `tags`, `security`). `index.ts` registers rate limiting via `RateLimit.options('<entity>')` then every operation. Paths: `POST /new`, `POST /list`, `GET /:id`, `PATCH /` (bulk `{ ids, data }`), `POST /:id/archive`, `POST /:id/restore`, `DELETE /` (bulk `{ ids }`).

## Conventions (non-negotiable)

- snake_case on the wire and in the database; camelCase only for local variables.
- Classes over object literals for utils and services; short noun classes with one-word methods (`Reply.send`, `Cursor.paginate`, `Access.team.require`).
- One contract: no backward-compatibility shims, legacy flags, fallback chains.
- Never `throw new Error(...)` in request paths; always a registered factory. Never leak internals. Ids and route names go in `metadata`.
- Logging: ids and counts only, never names, emails or content.
- Every query scoped to what the actor may see. Every route has auth scopes. Every input schema has `additionalProperties: false` and bounds.
- No `any`. Named exports only. Explicit `public` and explicit return types.
- Alphabetical everything (object keys, type members, class members, unions, schema properties). Imports: external, `@/`, relative, blank line, `import type` last.
- Blank line before `return`, early returns, guard clauses.

## JSDoc and comments

Every exported controller handler, service operation and util method has exactly this block and nothing else:

```ts
/**
 * @route team.service.create
 * @param {CreateParams} params
 * @returns {Promise<CreateResponse>}
 * @throws {TeamCreateError}
 */
```

`@route` matches the `route` in error metadata. List every thrown error in `@throws`, separated with `|`. No inline or explanatory comments anywhere. Schemas document themselves through `description`, `example` and `title` in clear professional English.

## Tests

`tests/unit/services/<entity>/<op>.test.ts` for every operation, controller tests for authz and bulk logic, mirroring `tests/unit/services/user/*`. Snapshot modules before mocking and restore in `afterAll`; dynamically import the unit under test after mocking; `mock.clearAllMocks()` in `afterEach`. Cover happy path, not found, forbidden, error wrapping (domain code + `cause` kept) and the audit log call.

## Definition of done

From `api/`: `bun run typecheck`, `bun run lint`, `bun run test:unit`, `bun run openapi:generate` pass with zero warnings; the generated spec lists the tag and every endpoint with request, response and error schemas.
