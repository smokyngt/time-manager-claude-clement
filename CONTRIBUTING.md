# Contributing

## Branching

- `main` is protected and always releasable. Work on short-lived branches: `feat/<topic>`, `fix/<topic>`, `chore/<topic>`, `docs/<topic>`.
- Open a pull request into `main`; squash-merge. The PR title becomes the commit message, so it must follow Conventional Commits (checked by CI).

## Conventional commits

`<type>(<optional scope>): <lowercase subject>`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
Scopes are usually `api`, `web`, `ci`, `docker`, `docs`. Breaking changes: `feat(api)!: ...` or a `BREAKING CHANGE:` footer.

## Running checks

```bash
make ci                                    # everything CI runs, locally
cd api && bun install && bun run typecheck && bun run lint && bun run test:unit
cd web && bun install && bun run typecheck && bun run lint && bun run test:unit && bun run build
```

Integration tests need PostgreSQL (see `docker-compose.dev.yml`). Playwright E2E lives in `web/e2e`.

## House style

API conventions are in [docs/API_CONVENTIONS.md](docs/API_CONVENTIONS.md); shared monorepo rules in
[docs/CONTRACT.md](docs/CONTRACT.md). Lint runs with `--max-warnings=0`. Editor settings come from `.editorconfig`.

## Pull requests

Fill in the template, keep PRs focused, add tests, regenerate `api/openapi.json` and web API types when the API changes.
Never commit secrets; use `.env` (git-ignored) based on `.env.example`.
