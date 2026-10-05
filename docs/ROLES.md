# Roles and permissions

Three roles exist: `employee`, `manager`, `admin`. Authorization has two stages, both required:

1. **Scope check** in the route `auth({ scopes })` preHandler: the role must grant every scope the route declares. Failure is `403 FORBIDDEN` before the controller runs.
2. **Controller check** with the `Access` helpers (`api/src/utils/access.ts`, `access/team.ts`, `access/clock.ts`): depends on the target (self, managed user, team manager) and, for updates, on which fields may be changed.

Role definitions and the "managed user" concept come from [DOMAIN.md](DOMAIN.md). Users and auth are implemented and mounted; teams, clocks and reports follow DOMAIN.md and their access helpers (`TeamAccess`, `ClockAccess`, `Membership`) already exist in `api/src`.

## Managed user

A **managed user** (relative to a manager) is a user who belongs to at least one **non-archived** team whose `manager_id` is that manager. Archiving a team ends the management relationship through that team; a user in no other team of that manager is no longer managed.

Implementation: `Membership.manages(actor, userId)` joins `team_members` and `teams` where `teams.manager_id = actor.id`, `team_members.user_id = userId` and `teams.archived_at IS NULL`. Admins manage everyone; employees manage nobody.

For user administration only, the code adds one extra case: a manager may also act on an **unassigned employee** (an employee who is in no non-archived team). This lets a manager create an employee and then place them in a team, and see who is available to add. This is implemented in `Access.user.scope` and in the `managed_by` filter of `user.service.list`. Clocks, reports and team data never use this extension.

## Scopes per role

Defined in `api/src/config/auth/roles.ts`.

| Scope | employee | manager | admin |
|---|:-:|:-:|:-:|
| `auth:self` | yes | yes | yes |
| `users:read` | yes | yes | yes |
| `users:write` | yes | yes | yes |
| `users:manage` | - | yes | yes |
| `teams:read` | yes | yes | yes |
| `teams:manage` | - | yes | yes |
| `clocks:read` | yes | yes | yes |
| `clocks:write` | yes | yes | yes |
| `clocks:manage` | - | yes | yes |
| `reports:read` | yes | yes | yes |

Scopes are coarse. Manager and admin hold the same scopes; the difference between them is entirely in the controller checks (breadth of targets, role changes, deletions, `manager_id` assignment).

## Permission matrix

Legend: **Y** allowed; **own** only the caller's own record; **managed** only managed users (or teams the manager manages); **-** denied (403, or 404 where noted in DOMAIN.md). "Scope" is the route preHandler scope.

### Auth (`/v1/auth`)

| Endpoint | Scope | employee | manager | admin |
|---|---|:-:|:-:|:-:|
| `POST /login` | none | Y | Y | Y |
| `POST /refresh` | none (cookie) | Y | Y | Y |
| `POST /logout` | `auth:self` | Y | Y | Y |
| `GET /me` | `auth:self` | Y | Y | Y |
| `GET /microsoft`, `GET /microsoft/callback` | none | Y (if user exists) | Y | Y |

### Users (`/v1/users`) - implemented

| Endpoint | Scope | employee | manager | admin |
|---|---|:-:|:-:|:-:|
| `POST /new` | `users:manage` | - | employees only (role defaults to `employee`; creating a manager or admin is denied) | any role |
| `POST /list` | `users:manage` | - | employees only (role forced to `employee`): managed users and unassigned employees; a `role` filter other than `employee` is denied | all, any filter |
| `GET /:id` | `users:read` | own | own, or an employee in scope (managed or unassigned) | Y |
| `PATCH /` (bulk) | `users:write` | own, fields `first_name`, `last_name`, `phone_number`, `password` | own (same fields); employees in scope, fields add `email` | Y; fields add `email` and `role` |
| `POST /:id/archive` | `users:manage` | - | employees in scope; never self | Y; never self |
| `POST /:id/restore` | `users:manage` | - | employees in scope | Y |
| `DELETE /` (bulk) | `users:manage` | - | employees in scope; never self | Y; never self |

Notes: in bulk `PATCH` and `DELETE`, authorization is checked for every id first; one forbidden id rejects the whole request. A caller cannot archive or delete themselves. List filters include `team_id`, `role`, `archived`, `ids`, `created_after`, `created_before`.

### Teams (`/v1/teams`) - per DOMAIN.md

| Endpoint | Scope | employee | manager | admin |
|---|---|:-:|:-:|:-:|
| `POST /new` | `teams:manage` | - | Y, `manager_id` forced to self | Y, any `manager_id` (must be a manager or admin user) |
| `POST /list` | `teams:read` | teams they belong to | teams they manage or belong to | all |
| `GET /:id` | `teams:read` | if member | if manager of it or member | Y |
| `PATCH /` (bulk) | `teams:manage` | - | managed teams; fields `name`, `description`, `weekly_hours_target`, `work_start`, `work_end` | Y; adds `manager_id` |
| `POST /:id/archive`, `POST /:id/restore` | `teams:manage` | - | managed teams | Y |
| `DELETE /` (bulk) | `teams:manage` | - | - | Y |
| `POST /:id/members/add` | `teams:manage` | - | managed teams, employees only | Y |
| `POST /:id/members/remove` | `teams:manage` | - | managed teams | Y |
| `POST /:id/members/list` | `teams:read` | if member | if manager of it or member | Y |

### Clocks (`/v1/clocks`) - per DOMAIN.md

| Endpoint | Scope | employee | manager | admin |
|---|---|:-:|:-:|:-:|
| `POST /in` | `clocks:write` | own | own | own |
| `POST /out` | `clocks:write` | own | own | own |
| `GET /current` | `clocks:read` | own | own | own |
| `POST /new` (manual entry) | `clocks:manage` | - | managed | Y |
| `POST /list` | `clocks:read` | own only (`user_ids` forced to self) | self + managed (requested ids are intersected with that set) | all |
| `GET /:id` | `clocks:read` | own | own, or clocks of managed users | Y |
| `PATCH /` (bulk) | `clocks:manage` | - | managed | Y |
| `DELETE /` (bulk) | `clocks:manage` | - | managed | Y |

`ClockAccess.users(actor, requested)` implements the list narrowing: employee gets `[self]`, admin gets what was requested (or everything), manager gets self plus `Membership.members(manager)` filtered by the request.

### Reports (`/v1/reports`) - per DOMAIN.md

| Endpoint | Scope | employee | manager | admin |
|---|---|:-:|:-:|:-:|
| `POST /user` | `reports:read` | own | own, or managed users | Y |
| `POST /team` | `reports:read` | - | teams they manage | Y |

### Other

| Endpoint | Auth |
|---|---|
| `GET /health` | none |
| `GET /docs`, `GET /docs/json` | none |

## Design rules

- Every route has a scope; every query is scoped to what the actor may see; authorization runs before the service is called.
- Role escalation is admin-only: only admins can set or change `role`, and only admins can create other managers or admins.
- Self-service is limited to non-privileged fields; an employee cannot change their own email or role.
- Denials do not reveal why. The 403 body is generic and the specific action, role and target are logged as metadata only.
- A role change takes effect for new access tokens (after the next refresh, at most `JWT_ACCESS_TTL`), since scopes are derived from the role in the token and refresh reloads the user.
