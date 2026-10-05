# Time Manager - web

React 19, Vite, TypeScript (strict), React Router v8, TanStack Query, Tailwind v4, shadcn/ui.

## Setup

```sh
bun install
cp .env.example .env   # VITE_API_URL empty = same origin (dev proxy / nginx)
bun run dev            # http://localhost:5173, proxies /v1 and /docs to http://localhost:8000
```

## Scripts

| Script      | Purpose                                                       |
| ----------- | ------------------------------------------------------------- |
| `dev`       | Vite dev server                                               |
| `build`     | type-check then build to `dist/`                              |
| `typecheck` | `tsc -b --noEmit`                                             |
| `lint`      | ESLint (zero warnings)                                        |
| `format`    | Prettier                                                      |
| `test:unit` | Vitest                                                        |
| `api:types` | generate `src/lib/api/schema.d.ts` from `../api/openapi.json` |

`src/lib/api/schema.d.ts` is currently a hand-written minimal version; run `bun run api:types` once `api/openapi.json` exists.

## Structure

```
src/
  components/ui/       shadcn components
  components/layout/   app shell (sidebar, top bar, theme toggle, user menu)
  features/<name>/     api, components, hooks, pages
  lib/api/             openapi-fetch client, auth fetch wrapper (refresh then retry), errors
  lib/auth/            in-memory token, AuthProvider, ProtectedRoute, RoleRoute
  lib/theme/           light/dark/system theme
  routes.tsx           router
```

Auth: the access token lives in memory only; the refresh token is an httpOnly cookie. On boot the app silently calls `POST /v1/auth/refresh`.
