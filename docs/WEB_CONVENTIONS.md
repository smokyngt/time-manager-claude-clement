# Web client engineering brief

Binding rules for `web/` and `sdks/typescript/`. This is the Prosperify web client brief adapted to Time Manager. Reference features, once migrated: `teams` (primary) and `users` (secondary). When this brief and the reference code disagree, the code wins and the disagreement is reported.

| Prosperify | Time Manager |
|---|---|
| `client/` | `web/` |
| `@prosperify/sdk`, `ProsperifyClient`, `ProsperifyError` | `@time-manager/sdk`, `TimeManagerClient`, `TimeManagerError` (package in `sdks/typescript`, consumed through the `@time-manager/sdk` path alias in `web/tsconfig` and `web/vite.config.ts`) |
| React 18, React Router v7 | React 19, React Router v8 (data router, lazy pages) |
| Step-up provider | Not used |
| Store-level grants | Role-derived scopes returned by the API (`scopes` on `GET /v1/auth/me`, login and refresh) |

## 1. Stack

| Concern | Choice |
|---|---|
| Build | Vite, ESM, TypeScript strict, `@/` alias |
| UI | React 19 function components + hooks |
| Server state | TanStack Query v5; server data never goes into a global store |
| Client state | Zustand (`src/stores/`): auth session (access token in memory only), UI preferences (`persist`), undo history |
| API access | `@time-manager/sdk`, one instance in `@/config/sdk` |
| Routing | React Router data router, lazy pages, guards as layout routes |
| Forms | Controlled inputs; react-hook-form + zod for larger forms; limits from `@/config/limits` |
| Components | Radix primitives wrapped in `src/components/ui/*` (shadcn), Tailwind v4, `cn()`, lucide icons |
| Charts | recharts with CSS-variable colors |
| i18n | i18next + react-i18next, one namespace per feature, `en` + `fr`, key parity tested |
| Tests | Vitest + Testing Library (unit), Playwright (`e2e/`) |
| Lint | ESLint 9 + typescript-eslint, react, react-hooks, perfectionist, Prettier |

## 2. Architecture

```
src/
  config/
    sdk.ts            the single TimeManagerClient instance (token getter, refresh, logout wired in)
    query.ts          QueryClient, QueryEvents (errors/success), global error and success hooks, staleTime defaults
    query-keys.ts     QueryKeys class: every cache key
    limits.ts         input limits shared with the API
  features/<feature>/
    components/       feature components + index.ts barrel
    hooks/            data hooks (queries, mutations)
    lib/              pure helpers (no React)
    pages/            route-level pages + index.ts barrel (lazy-loaded)
  components/ui/      design-system primitives
  components/shared/  ListToolbar, SearchInput, Pagination, ConfirmDialog, ErrorState, Empty,
                      ResponsiveDetail, BulkActionBar, PageHeader, Announcer
  hooks/              useOptimisticCache, useUndo, useListPagination, useCursorPagination,
                      useMultiSelect, useDebouncedValue, useDocumentTitle, useMultiParams,
                      useViewMode, useRovingTabindex, shortcuts (useDeleteShortcut, useSelectAllShortcut,
                      useClearSelectionShortcut, useSearchHotkey)
  lib/                pure utilities as classes (Errors, Permission, Scopes, Duration, Dates, cn)
  providers/          AuthProvider (useAuth), ToastProvider (useToastActions), ErrorBoundary, ThemeProvider, I18nProvider
  router/             index.tsx (route tree), lazy.tsx (Lazy loader), guards (AuthGuard, GuestGuard, PermissionGuard)
  stores/             Zustand stores
  locales/{en,fr}/    one JSON namespace per feature + common.json + errors.json
  test-support/       TestI18n, query wrapper, auth, clock, keyboard and toast helpers
```

Data flow: Page → feature hooks → `sdk.<resource>.<op>()` → API. Hooks own query keys, invalidation, optimistic updates and success messages. Pages own page state, permissions and shortcuts. Components take data and callbacks through props; a missing callback hides the action (`onDelete={canManage ? handleDelete : undefined}`).

## 3. SDK (`sdks/typescript`)

- The API speaks snake_case; the SDK converts both directions (`Payload.serialize` / `Payload.deserialize`) and unwraps the `{ data, event, timestamp }` envelope, returning `data` (named objects such as `{ team }`, `{ items, more, next, total }`). The client never converts case and never types against snake_case.
- `HttpClient`: base URL, `credentials: 'include'`, bearer from a token getter, JSON, timeout with `AbortController`, single-flight refresh on `token.authentication.failed` then one retry, `onLogout` callback when refresh fails.
- Errors: `TimeManagerError` (`code`, `status`, `correlationId`, `metadata`) and subclasses `AuthenticationError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `ValidationError` (400, `errors`), `RateLimitError` (429, `retryAfter`), `ServerError` (5xx), `NetworkError` (`isTimeout`). `ErrorCodes` const lists every API code.
- Resources: `auth`, `users`, `teams`, `teamMembers`, `clocks`, `reports`, one class each in `src/resources/`, methods mirroring the API (`create`, `list`, `retrieve`, `update(ids, data)`, `archive`, `restore`, `delete(ids)`, plus `clocks.in/out/current`, `teamMembers.add/remove/list`, `reports.user/team`, `auth.login/refresh/logout/me/microsoftUrl`).
- Public types are `interface` with a `/** */` doc on the type and on every field. Tests under `src/__tests__/`.

## 4. Server state

- Every key comes from `QueryKeys` (`QueryKeys.teams()`, `QueryKeys.team(id)`, `QueryKeys.teamMembers(id)`, `QueryKeys.clocks(filters)`, `QueryKeys.currentClock()`, `QueryKeys.userReport(params)`, `QueryKeys.teamReport(params)`, `QueryKeys.users(filters)`, `QueryKeys.user(id)`, `QueryKeys.me()`). Keys are hierarchical.
- Global behaviour (`config/query.ts`): auth errors retry once after refresh; `Errors.retryable` (network, 5xx, 429) retry up to 2 times with exponential backoff capped at 30 s; mutations never retry. Failed queries are reported and toasted through `QueryEvents.errors` unless `meta: { suppressError: true }`. Mutations without `onError` are toasted globally. `meta: { successMessage }` (string or `(data, variables) => string`) toasts success.
- Query hooks return a stable empty constant and a small named object (`{ teams, loading, loaded, isError, refetch }`).
- Delete order: cancel → remove detail query → navigate → invalidate lists.
- List pages delete optimistically behind an undo toast (`useOptimisticCache` + `useUndo().deferAction`); create and update push undo entries.

## 5. Errors

| Situation | What to do |
|---|---|
| Query fails | Global toast; render `<ErrorState onRetry>` in place of the content |
| Inline query failure | `meta: { suppressError: true }` and render the error |
| Mutation fails, generic toast fine | No `onError` |
| Mutation needs context (dialog) | `onError: (err) => showError(t('create.title'), Errors.translate(err))`, keep the dialog open |
| Specific code changes the UI | `Errors.code.check(err, 'clock.conflict')` → inline feedback |
| Any error to text | `Errors.translate(err)`; every API code is in `locales/{en,fr}/errors.json` |
| Auth/session | Never in features: the SDK refreshes, logout redirects to `/login?redirect=…` |
| Forbidden routes | `<PermissionGuard scope={RESOURCE_SCOPES.teams.manage} />` renders `AccessDenied`; in pages hide actions with `Permission.scope.any(scopes, [...])` |
| Render errors | App error boundary only |

Never show raw messages, statuses or codes.

## 6. Components, pages, routing

- One form component for create and edit; validates limits client-side (`aria-invalid`, `role="alert"`, disabled submit), trims text, never calls the SDK.
- Lists: skeletons while loading, `Empty` when empty, `viewMode` grid/list via `useViewMode`, roving tabindex, `memo` cards, actions in `DropdownMenu` + `ContextMenu` rendered only when the callback exists, destructive actions through `ConfirmDialog variant="destructive"`, bulk selection props.
- Pages follow the 8-step structure: `useDocumentTitle(t('title'))`; search + debounce, order, URL filters (`useMultiParams`), pagination, multi-select, dialogs; data hooks and mutations; permissions; memoized derived data and callbacks; shortcuts; `ListToolbar` / `ErrorState` / list / `BulkActionBar` / `Pagination` / dialogs / `ResponsiveDetail`; `Announcer.say` for selection counts; `pages/index.ts` barrel.
- Routes in `router/index.tsx` with `Lazy.element(...)` from `router/lazy.tsx`, guarded by `PermissionGuard`; nav in `components/nav` with `isNavActive`; deep-linkable state in the URL.

## 7. Translations

`src/locales/{en,fr}/<namespace>.json` with identical keys, namespace registered in `lib/i18n.ts`. Keys are lowercase snake_case grouped by area (`title`, `actions.*`, `form.*`, `create.*`, `edit.*`, `delete.*`, `bulk.*`, `toast.*`, `empty.*`, `error.*`, `search.*`). Plurals ship `_one`/`_other` in both languages. Cross-namespace keys use a prefix (`common:actions.delete`, `errors:team.not.found`). Parity and key-format tests fail the build.

## 8. Conventions

- `type`, not `interface` (SDK public types excepted). Separate `import type` statements. Property-style method signatures. No `any`. Unused args prefixed `_`. Non-null assertions only behind an `enabled` guard. SDK entity types only; never redefine API shapes.
- Import order: side-effect → builtin → external → `@/` → parent → sibling → index → `import type`; named imports sorted.
- Prettier: 100 columns, single quotes, semicolons, trailing commas, 2 spaces, LF. `curly: all`, `eqeqeq`, `object-shorthand`, no `console.log`.
- React: named `function` components, `memo(function Name(...))` for list items, props type right above, hooks `useX` in `use-x.ts` returning named objects, exhaustive deps respected, `useMemo`/`useCallback` for memoized children, Tailwind tokens + `cn()`, full accessibility, every visible string through `t()`.
- Utility classes with static members (`Errors.translate`, `Permission.scope.any`, `QueryKeys.teams`, `Duration.format`).
- JSDoc only on static methods of utility classes:
  ```ts
  /**
   * @route client.<area>.<class>.<method>
   * @param {Type} name
   * @returns {Type}
   */
  ```
  No JSDoc on components and hooks; no inline comments anywhere.
- One contract: no fallbacks for old shapes.

## 9. Tests

Tests live next to the code in `__tests__/`. Mock the SDK with `vi.hoisted` + `vi.mock('@/config/sdk', ...)`; use the real `queryClient` cleared in `beforeEach`; assert global toasts through `QueryEvents`. `TestI18n.module()` makes `t('key')` return the key. Cover hooks (SDK call, invalidation, navigation, single toast, error path), forms (limits, trimming, disabled submit, edit prefill), lists (skeletons, empty, hidden actions, bulk toggle), pages (permission-gated actions), `lib/` helpers, locale parity.

## 10. Definition of done

From `web/`: `bun run typecheck`, `bun run lint`, `bun run test:unit`, `bun run build`. From `sdks/typescript/`: `bun run typecheck`, `bun run lint`, `bun test`, `bun run build`. Then run the app and check every flow in both languages and both themes, including undo, empty and error states, and a user without the write scope.
