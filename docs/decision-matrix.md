# Decision Matrix

Time Manager project: technology choices for backend, frontend and data layer.

## 1. Context and fixed constraints

The team has already fixed the following: Docker + Docker Compose for deployment, GitHub Actions for CI, JWT access tokens with rotating refresh tokens, and Microsoft OAuth 2.0 (required by the subject). The application lets employees clock in and out, and lets managers manage teams and view KPIs (hours worked, lateness, averages), so date/time handling and aggregation matter.

## 2. Criteria (locked)

Weights were agreed before scoring and are not changed afterwards. Scores run from 1 (poor) to 5 (excellent). Weighted total = sum of (score x weight); maximum = 5 x 16 = 80.

| ID | Criterion | Weight (1-3) |
|---|---|:-:|
| C1 | Team experience | 3 |
| C2 | Ecosystem quality (OAuth 2.0 providers, charting libraries) | 3 |
| C3 | Date/time handling and aggregation | 3 |
| C4 | Docker deployment complexity (higher = simpler) | 2 |
| C5 | Community and long-term viability | 2 |
| C6 | Learning value | 1 |
| C7 | Type safety and developer experience | 2 |

## 3. Backend matrix

| Option | C1 (x3) | C2 (x3) | C3 (x3) | C4 (x2) | C5 (x2) | C6 (x1) | C7 (x2) | Total /80 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Bun + Fastify 5 (TypeScript) | 4 | 5 | 4 | 4 | 4 | 4 | 5 | **69** |
| Python FastAPI | 3 | 4 | 5 | 4 | 5 | 3 | 3 | **63** |
| Java Spring Boot | 2 | 5 | 4 | 3 | 5 | 4 | 4 | **61** |
| Go Gin | 2 | 3 | 3 | 5 | 4 | 5 | 4 | **55** |

Reading: Bun + Fastify leads thanks to team experience, ecosystem fit and type safety. FastAPI is strongest on data handling (Python date/time and analytics libraries) but costs a language switch. Spring Boot is mature but heavy for the team and the Docker footprint. Go Gin is lean but has a thinner OAuth and ORM ecosystem and less team experience.

## 4. Frontend matrix

| Option | C1 (x3) | C2 (x3) | C3 (x3) | C4 (x2) | C5 (x2) | C6 (x1) | C7 (x2) | Total /80 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| React 19 + Vite | 5 | 5 | 5 | 4 | 5 | 3 | 4 | **74** |
| Vue.js 3 | 2 | 4 | 4 | 4 | 4 | 4 | 4 | **58** |
| Angular | 1 | 4 | 4 | 3 | 4 | 4 | 5 | **55** |
| Svelte / SvelteKit | 1 | 3 | 3 | 4 | 3 | 4 | 4 | **47** |
| Flutter (mobile only) | 1 | 3 | 3 | 3 | 4 | 5 | 4 | **48** |

Reading: React wins on team experience and ecosystem (shadcn/ui, TanStack Query and recharts all target React). Flutter was scored for completeness as a possible mobile client; it does not fit a browser SPA and is out of scope for this phase.

## 5. ORM / database matrix

All options use PostgreSQL; the comparison is between access layers.

| Option | C1 (x3) | C2 (x3) | C3 (x3) | C4 (x2) | C5 (x2) | C6 (x1) | C7 (x2) | Total /80 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| PostgreSQL + Drizzle | 4 | 4 | 4 | 5 | 3 | 4 | 5 | **66** |
| PostgreSQL + Prisma | 3 | 5 | 4 | 3 | 5 | 3 | 5 | **65** |
| PostgreSQL + TypeORM | 3 | 3 | 3 | 4 | 3 | 2 | 3 | **49** |

Reading: Drizzle (66) and Prisma (65) are close. Drizzle is preferred for SQL-level control over date truncation and aggregation, a lighter Docker image and no code-generation step; Prisma remains the fallback. TypeORM trails on type safety and maintenance momentum.

## 6. Individual matrices

The subject requires each member to fill in their own matrix independently, before seeing the others'. The tables below are templates, to be completed individually and not by the group.

### Member A

| Option | C1 | C2 | C3 | C4 | C5 | C6 | C7 | Weighted total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| _Option 1_ | | | | | | | | |
| _Option 2_ | | | | | | | | |
| _Option 3_ | | | | | | | | |

### Member B

| Option | C1 | C2 | C3 | C4 | C5 | C6 | C7 | Weighted total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| _Option 1_ | | | | | | | | |
| _Option 2_ | | | | | | | | |
| _Option 3_ | | | | | | | | |

### Member C

| Option | C1 | C2 | C3 | C4 | C5 | C6 | C7 | Weighted total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| _Option 1_ | | | | | | | | |
| _Option 2_ | | | | | | | | |
| _Option 3_ | | | | | | | | |

### Divergences > 2 points

To be filled after all individual matrices are submitted. List each option and criterion where two members differ by more than 2 points.

| Option | Criterion | Member A | Member B | Member C | Gap | Resolution |
|---|---|:-:|:-:|:-:|:-:|---|
| | | | | | | |
| | | | | | | |

## 7. Recommendation (261 words)

We recommend TypeScript on Bun with Fastify 5 for the backend and React 19 with Vite for the frontend, backed by PostgreSQL and Drizzle ORM. The backend scored 69/80 against 63 for FastAPI, and React scored 74/80, well ahead of Vue at 58.

Two criteria drove the decision. First, suitability for date/time handling and aggregation (weight 3): clock-in records, lateness and averages require reliable timestamps, time zones and SQL grouping, which PostgreSQL's timestamptz and Drizzle's typed queries handle well, while recharts gives managers a mature charting layer. Second, team experience (weight 3): the team already knows TypeScript, so one language and shared types across API and SPA reduce onboarding time and integration bugs.

The main trade-off is Bun's younger ecosystem compared with Node.js. Some libraries may behave differently on Bun, and its long-term support is less proven. We mitigate this by writing Node-compatible code without Bun-only APIs where avoidable, pinning Bun and dependency versions, running CI on Bun in GitHub Actions, and keeping a documented fallback: switching the Docker base image to Node.js should require only a Dockerfile change and a regenerated lockfile.

One disagreement concerned the database. A proposal to use MongoDB for its flexible schema and quick start competed with PostgreSQL. We resolved it by returning to the subject, which requires a relational model with an ORM, and to the data itself, which is relational by nature: users belong to teams, teams have managers, and clocks reference users. Joins, constraints and aggregate queries for KPIs are also simpler in SQL. The decision was recorded and the MongoDB option dropped.
