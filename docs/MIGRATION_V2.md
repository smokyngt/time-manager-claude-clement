# API core v2 migration guide

Applies `docs/API_CONVENTIONS.md`. The new infrastructure lives next to the old one until every resource is migrated; then `app.v2.ts` becomes `app.ts`, `server.v2.ts` becomes `server.ts`, and the old modules are deleted.

## Imports

| Old | New |
|---|---|
| `@/lib/errors/index.js` (`registerError`, `AppError`, core errors) | `@/lib/errors/base/registry.js` (`registerError`, `AppError`), `@/lib/errors/base/core.js` |
| `@/lib/errors/handler.js` | `@/middlewares/error.js` |
| `@/lib/events/index.js` (`registerEvent`, `AppEvent`) | `@/lib/events/base/registry.js` |
| `@/utils/reply.js` | `@/utils/http/reply.js` |
| `@/utils/cursor.js` | `@/utils/http/cursor.js` |
| `@/utils/rate-limit.js` | `@/utils/http/rate-limit.js` |
| `@/utils/access.js`, `@/utils/access/*.js` | `@/utils/auth/authz.js` |
| `@/plugins/auth.js` | `@/middlewares/auth/index.js` |
| `@/types/envelope.js` | `@/types/misc/reply.js` |
| `@/schemas/common.js` envelope/error helpers | `@/schemas/base/envelope.js` |
| `@/utils/<entity>-mapper.js` | `@/utils/mappers/<entity>.js` |
| `tests/helpers/fake-db.ts` | `tests/support/db.ts` (`FakeDb`) |
| `tests/helpers/fixtures.ts` `makeReq` / `makeReply` | `tests/support/fake.ts` `Fake.request` / `Fake.reply` |

Each domain exports its errors and events through the barrels `@/lib/errors/index.js` and `@/lib/events/index.js` once the old core modules are removed; until then import domain files directly.

## Factories

- Codes are dotted lowercase: `USER_NOT_FOUND` → `user.not.found`, `TEAM_MEMBER_ADD_ERROR` → `team.member.add.failed`.
- `registerError({ code, defaultStatus })`; no `message`.
- `registerEvent<Payload>({ code })`; payloads hold `actor` plus ids and counts.
- Types use `type X = { ... }`.

## Core errors

| Old | New |
|---|---|
| `UnauthorizedError` (401) | `TokenAuthenticationError` (`token.authentication.failed`) |
| `ForbiddenError` (403) | `UnauthorizedError` (`unauthorized`) |
| `ValidationError`, `RateLimitError` | same names, `validation.error`, `rate.limit.exceeded` |
| new | `DuplicateKeyError`, `InvalidJsonError`, `PayloadTooLargeError`, `NotFoundError` (`route.not.found`), `InternalError` |

Postgres `23505` anywhere in the cause chain maps to `409 duplicate.key`; domain conflict errors stay for explicit rules.

## Auth and context

- `req.actor` is gone. Controllers use `const { actor, scopes } = Access.context(req)`.
- `auth({ scopes })` from `@/middlewares/auth/index.js` loads the user (`Identity.load`): bad token, missing or archived user → 401 `token.authentication.failed`; missing scope → 403 `unauthorized`.
- `Access.user`, `Access.team`, `Access.clock`, `Access.role` live in `utils/auth/authz.ts`.

## Replies and schemas

- `await Reply.send(req, reply, Event({ payload }), data)` → `{ data, event: { code, correlation_id, metadata, payload }, timestamp }`.
- `data` is a named object: `{ user }`, `{ items, more, next, total }`, `{ success, updated, failed }`.
- Errors: `{ code, correlation_id, instance, status, timestamp, errors? }` (+ `metadata`, `stack` outside production).
- Response schemas: `200: { content: { 'application/json': { schema: ReplyEnvelopeSchema(DataSchema, Event.code) } }, description }`, `400: ValidationErrorSchema`, `401: TokenAuthenticationErrorSchema`, `403: UnauthorizedErrorSchema`, `429: RateLimitErrorSchema`, other statuses `ErrorSchema(Factory)`; every status wrapped as `{ content: { 'application/json': { schema } }, description }`.
- Ajv strips unknown properties and coerces types; every input schema keeps `additionalProperties: false`.

## Routers

```ts
const teams: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    errorResponseBuilder: RateLimit.error,
    keyGenerator: RateLimit.key,
    max: Config.store.number('TEAM_RATE_LIMIT_MAX', 6000),
    timeWindow: Config.store.text('TEAM_RATE_LIMIT_WINDOW', '1 minute'),
  });
  await fastify.register(create);
};

export { teams };
```

Each route file: `const create: FastifyPluginAsync = async (fastify) => { ... }; export { create };` (`deleteRoute` for `delete`). `routes/index.ts`: `export { teams as teamRouter } from './team/index.js';`.

## Tests

- `FakeDb` from `tests/support/db.ts` (joins, `onConflictDoNothing`, `returning`, `transaction`).
- `Fake.request({ actor, body, params, query, scopes })`, `Fake.reply()`.
- Route tests: `Prehandler.install()` in `beforeAll`, `const app = await Prehandler.app(router, '/v1/teams')`, `Prehandler.allowed(route, scope)`, `Prehandler.denied(route, scope)`, `Prehandler.unauthenticated(route)`, `Prehandler.restore()` in `afterAll`.
- `Loose<T>` from `tests/support/loose.ts` for partial fixtures.
