# Domain model

Time Manager: employees clock in and out, managers run teams and follow KPIs, admins (general managers) run the whole company.

All timestamps are epoch milliseconds (UTC). Times of day (`work_start`, `work_end`) are `HH:MM` strings interpreted in the company timezone `APP_TIMEZONE` (default `Europe/Paris`). Every response uses the envelope `{ data, event }`; lists return `data: { items, more, next, total }`.

## Roles

| Role | Can |
|---|---|
| `employee` | Clock in/out, see and edit own profile, see own clocks and own reports, see teams they belong to. |
| `manager` | Everything an employee can, plus: create employees, create teams they manage, manage members of teams they manage, see/correct clocks and reports of members of teams they manage. |
| `admin` | Everything, on every user, team and clock. |

"Managed user" = a user who belongs to at least one non-archived team whose `manager_id` is the actor.

## Users (`/v1/users`, tag `users`) – done

Entity: `id, object: 'user', email, first_name, last_name, phone_number, role, created_at, updated_at, archived_at`.
List filters add `team_id` (members of that team).

## Teams (`/v1/teams`, tag `teams`, scopes `teams:read` / `teams:manage`)

Tables: `teams`, `team_members` (`db/schema/team.ts`).

Entity `Team`: `id, object: 'team', name (1–100), description (null | ≤500), manager_id, member_count, weekly_hours_target (1–80, default 35), work_start ('09:00'), work_end ('17:00'), created_at, updated_at, archived_at`.

| Method & path | Body / params | Returns | Who |
|---|---|---|---|
| `POST /new` | `{ name, description?, manager_id?, weekly_hours_target?, work_start?, work_end? }` | `Team` | admin (any manager_id, must be a manager/admin user); manager (manager_id forced to self) |
| `POST /list` | `{ ids?, manager_id?, member_id?, archived?, created_after?, created_before?, cursor?, limit?, order? }` | page of `Team` | admin all; manager teams they manage or belong to; employee teams they belong to |
| `GET /:id` | | `Team` | same visibility as list |
| `PATCH /` | `{ ids, data: { name?, description?, manager_id? (admin only), weekly_hours_target?, work_start?, work_end? } }` | `{ success, updated, failed }` | admin; manager on teams they manage |
| `POST /:id/archive` / `POST /:id/restore` | | `Team` | admin; manager on teams they manage |
| `DELETE /` | `{ ids }` | `{ success, deleted, failed }` | admin |
| `POST /:id/members/add` | `{ user_ids }` (≤100) | `{ success, added, failed }` | admin; manager on teams they manage (only employees) |
| `POST /:id/members/remove` | `{ user_ids }` | `{ success, removed, failed }` | admin; manager on teams they manage |
| `POST /:id/members/list` | `{ cursor?, limit?, order? }` | page of `User` | anyone who can see the team |

`work_end` must be after `work_start` (`HH:MM`, pattern `^([01]\d|2[0-3]):[0-5]\d$`).

## Clocks (`/v1/clocks`, tag `clocks`, scopes `clocks:read` / `clocks:write` / `clocks:manage`)

Table: `clocks` (`db/schema/clock.ts`). At most one open clock (no `clocked_out_at`) per user, enforced by a partial unique index.

Entity `Clock`: `id, object: 'clock', user_id, clocked_in_at, clocked_out_at (null while open), duration_ms (null while open), note (null | ≤500), source ('clock' | 'manual'), created_at, updated_at`.

| Method & path | Body / params | Returns | Who |
|---|---|---|---|
| `POST /in` | `{ note? }` | `Clock` (open) | self; 409 `clock.conflict` if already clocked in |
| `POST /out` | `{ note? }` | `Clock` (closed) | self; 409 `clock.conflict` if not clocked in |
| `GET /current` | | `{ clock: Clock \| null }` | self |
| `POST /new` | `{ user_id, clocked_in_at, clocked_out_at, note? }` (manual entry, `source: 'manual'`) | `Clock` | manager for managed users; admin |
| `POST /list` | `{ user_ids?, from?, to?, open?, cursor?, limit?, order? }` (`from`/`to` bound `clocked_in_at`) | page of `Clock` | employee: own only (user_ids ignored/forced); manager: self + managed users; admin all |
| `GET /:id` | | `Clock` | owner, manager of owner, admin |
| `PATCH /` | `{ ids, data: { clocked_in_at?, clocked_out_at?, note? } }` | `{ success, updated, failed }` | manager for managed users; admin |
| `DELETE /` | `{ ids }` | `{ success, deleted, failed }` | manager for managed users; admin |

Rules: `clocked_out_at > clocked_in_at`; no future timestamps; a single clock cannot exceed 24 h; a manual or corrected clock must not overlap another clock of the same user (409).

## Reports (`/v1/reports`, tag `reports`, scope `reports:read`)

Read-only KPIs computed with SQL aggregation over closed clocks (open clocks count up to `now`).

`granularity`: `day` | `week` | `month`. Range `from`/`to` (ms, max 366 days).

| Method & path | Body | Returns | Who |
|---|---|---|---|
| `POST /user` | `{ user_id, from, to, granularity }` | `UserReport` | self, manager of the user, admin |
| `POST /team` | `{ team_id, from, to, granularity }` | `TeamReport` | manager of the team, admin |

`UserReport`:
```
{
  object: 'user_report', user_id, from, to, granularity,
  kpis: {
    worked_ms,            total worked time in range
    days_worked,          distinct days with at least one clock
    average_daily_ms,     worked_ms / days_worked (0 when none)
    target_ms,            weekly_hours_target of the user's teams (max), prorated to the range's working days (Mon–Fri)
    overtime_ms,          worked_ms - target_ms (can be negative)
    late_days,            days whose first clock-in is more than 5 minutes after work_start
    lateness_rate         late_days / days_worked (0..1)
  },
  series: [{ period_start, worked_ms, late }]   one bucket per granularity period, zero-filled
}
```

`TeamReport`: `{ object: 'team_report', team_id, from, to, granularity, kpis: { worked_ms, average_daily_ms, member_count, active_members, late_days, lateness_rate, overtime_ms }, series: [{ period_start, worked_ms }], members: [{ user_id, first_name, last_name, worked_ms, days_worked, late_days, overtime_ms }] }`.

When a user belongs to several teams, `work_start` is taken from the earliest `work_start` of their non-archived teams; users in no team use `09:00` and 35 h.

## Audit

Every mutation writes an `audit_logs` entry through `logService.create`.
