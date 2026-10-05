# Performance and load testing

k6 scripts live in `ops/load/`. They exercise the real API with the demo accounts (`api/src/db/demo.ts`, password `Demo1234!`) and are run locally, against any environment, or weekly in GitHub Actions (`.github/workflows/load-test.yml`).

## Service level objectives

| Indicator | Target | Where it is enforced |
|---|---|---|
| p95 latency, reads | < 300 ms | `http_req_duration{kind:read}` and one threshold per endpoint |
| p95 latency, writes (`clocks.in`, `clocks.out`) | < 500 ms | `http_req_duration{kind:write}` |
| p95 latency, login | < 800 ms | `http_req_duration{kind:auth}` (password hashing bound) |
| Error rate | < 1 % | `http_req_failed` |
| Checks passed | > 99 % | `checks` |

Every request is tagged `name` (endpoint, never the URL, so no cardinality explosion) and `kind` (`read`, `write`, `auth`). Names: `health`, `auth.login`, `auth.me`, `users.list`, `users.retrieve`, `teams.list`, `teams.retrieve`, `teams.members.list`, `clocks.current`, `clocks.list`, `clocks.in`, `clocks.out`, `reports.user`, `reports.team`. The registry is `ops/load/lib/thresholds.js`; a new endpoint must be added there.

## Scenarios

| Script | Model | Purpose | Thresholds |
|---|---|---|---|
| `smoke.js` | 1 VU, 30 s | Every main endpoint once per iteration. Run first, gates the others | SLOs |
| `load.js` | `ramping-vus`, 5 min ramp to 50 VUs (40 employees, 10 managers), 2 min hold | Expected peak. Employees: current clock, clock in/out, own report, own clocks. Managers: list users, list teams, team report, team members | SLOs |
| `stress.js` | `ramping-arrival-rate`, +20 it/s every minute from 10 it/s, up to 1000 VUs | Find the knee: the rate where p95 leaves its budget, errors start or `dropped_iterations` grows | Lenient latency, aborts above 10 % errors |
| `spike.js` | `ramping-vus` 10 -> 100 VUs in 10 s, 1 min at peak, back to 10, 2 min recovery | Burst absorption and recovery | SLOs with doubled latency budgets (600 / 1000 ms) |
| `soak.js` | 20 VUs for 30 min | Leaks, pool exhaustion, drift, access token expiry (15 min) | SLOs |

Employees toggle their clock: `GET /v1/clocks/current`, then `POST /v1/clocks/in` or `/out`. Several VUs share the 12 demo employees, so a `409 clock.conflict` is a legitimate business answer, not an error: it is declared as an expected status, validated against the error envelope and counted in `clock_conflicts`.

Parameters (all `-e NAME=value`): `BASE_URL` (default `http://localhost:8000`), `DEMO_PASSWORD`, `THINK` (think-time factor in seconds, `0` removes it; `stress` defaults to 0), `SUMMARY_DIR` (default `ops/load/results`). Per scenario: `VUS_EMPLOYEES`, `VUS_MANAGERS`, `RAMP`, `HOLD` (load); `START_RATE`, `STEP_RATE`, `STEPS`, `STEP_DURATION`, `PRE_VUS`, `MAX_VUS` (stress); `BASE_VUS`, `SPIKE_VUS` (spike); `SOAK_VUS`, `SOAK_DURATION` (soak).

## Authentication and rate limits

* `setup()` logs in each demo account once (`POST /v1/auth/login`, 14 logins, 5 for the smoke) and hands the access tokens to every VU. VUs never log in per iteration. When a token is within 30 to 150 s (jittered per VU) of its expiry, the VU logs in again itself, so a 30 min soak costs about 2 logins per VU.
* Login retries on `429` honour `Retry-After` (counter `login_retries`).
* The API rate-limits per IP on login (`AUTH_LOGIN_RATE_LIMIT_MAX`, default 10 per minute) and per user on each router (`USER_`, `CLOCK_`, `TEAM_`, `REPORT_RATE_LIMIT_MAX`, default 100 per minute). The default limits are right for production and wrong for a load test: at 50 VUs a single employee exceeds 100 clock requests a minute. **Raise them on the target** (the workflow does) or you measure the limiter. The smoke test is light enough to run against default limits.
* `AUTH_ACCOUNT_RATE_LIMIT_MAX` locks an account after failed logins only; a wrong `DEMO_PASSWORD` locks the demo accounts after 5 attempts.

## Run locally

```sh
# 1. Database, migrations, demo data, API (see api/README.md)
cd api && bun run db:migrate && bun run db:seed:demo
AUTH_LOGIN_RATE_LIMIT_MAX=100000 USER_RATE_LIMIT_MAX=10000000 CLOCK_RATE_LIMIT_MAX=10000000 \
TEAM_RATE_LIMIT_MAX=10000000 REPORT_RATE_LIMIT_MAX=10000000 bun src/server.ts

# 2. k6 (https://grafana.com/docs/k6/latest/set-up/install-k6/)
k6 run ops/load/smoke.js
k6 run -e BASE_URL=http://localhost:8000 ops/load/load.js
k6 run -e RAMP=30s -e HOLD=30s ops/load/load.js     # quick version
```

Run the load test on a machine other than the API host: k6 and the API compete for CPU otherwise. Against the Docker stack use `BASE_URL=http://localhost:8080`.

## Reading the results

`handleSummary` writes, in `SUMMARY_DIR`:

* `<scenario>-summary.json`: the full k6 summary (all metrics, thresholds), for archiving and diffing.
* `<scenario>-summary.md`: verdict, headline metrics, latency per endpoint, every threshold. The same text goes to stdout. A run that issued no request (setup crash, API down) is reported `FAIL`.

In GitHub Actions the markdown is appended to the job summary and both files are uploaded as the `k6-<scenario>-<run id>` artifact (30 days). Exit code 99 means a threshold failed.

Finding the knee with `stress.js`: look at the first minute where p95 of `kind:read` exceeds 300 ms, `http_req_failed` becomes non-zero, or `dropped_iterations` appears (k6 could not start iterations fast enough, `Insufficient VUs` warning). The step before it is the sustainable rate. The per-step timeline needs the Prometheus output below; the summary only gives the aggregate.

## Prometheus remote write and native histograms

k6 can stream its metrics to the Prometheus of the observability stack (`docker-compose.observability.yml`, which starts Prometheus with `--web.enable-remote-write-receiver`).

```sh
K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
K6_PROMETHEUS_RW_TREND_AS_NATIVE_HISTOGRAM=true \
k6 run -o experimental-prometheus-rw --tag testid=load-$(date +%s) ops/load/load.js
```

* `K6_PROMETHEUS_RW_SERVER_URL` is the only required variable. Without it nothing is pushed; the scripts do not depend on it.
* `K6_PROMETHEUS_RW_TREND_AS_NATIVE_HISTOGRAM=true` sends trends (`k6_http_req_duration`) as native histograms instead of a fixed set of `_p99`, `_avg`... gauges, so any quantile can be computed per tag with `histogram_quantile(0.95, sum by (name) (rate(k6_http_req_duration_seconds{testid="..."}[1m])))`.
* Prometheus must run with `--enable-feature=native-histograms`. The stack does not set it yet: add it to the `prometheus` command in `docker-compose.observability.yml`. Without the flag, drop `K6_PROMETHEUS_RW_TREND_AS_NATIVE_HISTOGRAM` and k6 falls back to classic series (`k6_http_req_duration_p99`, ...).
* Prometheus is not published on the host by the compose file; reach it from the compose network, or publish `9090` for the test.
* `--tag testid=...` labels a run so concurrent or successive runs can be told apart in Grafana. Put API panels (from the stack's own metrics) and k6 panels on one dashboard to correlate latency with CPU, event loop and database pool saturation.
* In the workflow, the optional repository secret `K6_PROMETHEUS_RW_SERVER_URL` enables the output (`-o experimental-prometheus-rw`, native histograms, `testid=<run id>-<scenario>`). A GitHub-hosted runner can only reach a Prometheus that is reachable from the internet (or a self-hosted runner).

## GitHub Actions

`.github/workflows/load-test.yml`: manual (`workflow_dispatch`, input `scenario`) and weekly (Monday 03:43 UTC, `load`). It starts a `postgres:17-alpine` service, runs `db:migrate` and `db:seed:demo`, starts the API with `bun src/server.ts` and rate limits raised, waits for `/health`, then runs the script with `grafana/setup-k6-action` and `grafana/run-k6-action`. The job fails when a threshold fails. The runner (2 vCPU shared with the API and PostgreSQL) is a regression detector, not a capacity benchmark: compare runs with each other, not with production.

## Baseline: smoke run

Run on 2026-10-05, k6 v1.3.0 and API on the same 1 vCPU sandbox (Bun 1.3, PostgreSQL 16 `timemanager_load`, demo data: 14 users, 3 teams, 724 clocks), default API rate limits, `k6 run ops/load/smoke.js`. Result: **PASS**, 26 iterations, 320 requests, 0.00 % errors, 694 / 694 checks.

| Endpoint | Kind | Requests | avg | p95 | max |
|---|---|---|---|---|---|
| `health` | read | 26 | 2.2 ms | 5.0 ms | 8.8 ms |
| `auth.login` | auth | 5 | 251.8 ms | 394.3 ms | 431.6 ms |
| `auth.me` | read | 27 | 15.5 ms | 54.1 ms | 63.0 ms |
| `users.list` | read | 26 | 16.8 ms | 44.9 ms | 71.9 ms |
| `users.retrieve` | read | 26 | 11.4 ms | 21.2 ms | 21.3 ms |
| `teams.list` | read | 28 | 18.1 ms | 48.9 ms | 53.7 ms |
| `teams.retrieve` | read | 26 | 10.6 ms | 23.6 ms | 28.7 ms |
| `teams.members.list` | read | 26 | 16.9 ms | 39.4 ms | 56.6 ms |
| `clocks.current` | read | 26 | 15.0 ms | 38.4 ms | 62.5 ms |
| `clocks.list` | read | 26 | 14.8 ms | 37.8 ms | 55.6 ms |
| `clocks.in` | write | 13 | 21.9 ms | 59.8 ms | 101.4 ms |
| `clocks.out` | write | 13 | 27.6 ms | 64.0 ms | 95.2 ms |
| `reports.user` | read | 26 | 18.9 ms | 47.9 ms | 52.7 ms |
| `reports.team` | read | 26 | 26.3 ms | 60.3 ms | 81.1 ms |

Overall p50 / p90 / p95: 12.0 / 32.6 / 53.6 ms. Every endpoint is far inside its budget at one VU.

Short validation runs of the other scenarios on the same machine (rate limits raised, shortened with the environment variables above; these are script checks, not baselines):

* `load.js` (`RAMP=20s HOLD=10s`, 50 VUs): PASS, 3264 requests, 0 % errors, 100 % checks, p95 44 ms, 5 expected clock conflicts.
* `stress.js` (3 steps of 10 s from 50 it/s, +100 it/s): the single-process API on this 1 vCPU box saturated at roughly 60 iterations/s (about 240 requests/s): `dropped_iterations` appeared, p95 reached seconds and errors reached 2 %. This is the knee of the sandbox, useful only to show the scenario detects it.
* `soak.js`, `spike.js`: syntax and options validated with `k6 inspect`; `soak.js` smoke-run for 10 s. Full-length runs belong to CI or a dedicated host.

## Notes for maintainers

* The scripts match the HTTP contract of `docs/DOMAIN.md`. When a path or body changes, update `ops/load/lib/workload.js` and `smoke.js`.
* Demo data is deterministic (`Demo.SEED`) but clocks are written relative to "now"; reseed before comparing runs over weeks, as reports aggregate the last 30 days.
* Writes of the load test accumulate clocks of the demo employees. Use a disposable database (`timemanager_load`), never production data.
