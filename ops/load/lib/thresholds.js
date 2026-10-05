// Thresholds. Every request carries `tags: { name, kind }` (see lib/http.js), so thresholds are
// declared per `kind` (read | write | auth) and per endpoint `name`. Declaring a threshold on a
// tagged sub-metric is also what makes k6 emit that sub-metric in handleSummary.

// Endpoint registry: tag name -> kind. Keep names stable, dashboards and the report key on them.
export const ENDPOINTS = {
  'health': 'read',
  'auth.login': 'auth',
  'auth.me': 'read',
  'users.list': 'read',
  'users.retrieve': 'read',
  'teams.list': 'read',
  'teams.retrieve': 'read',
  'teams.members.list': 'read',
  'clocks.current': 'read',
  'clocks.list': 'read',
  'clocks.in': 'write',
  'clocks.out': 'write',
  'reports.user': 'read',
  'reports.team': 'read',
};

// p95 budgets in milliseconds. `auth` is hashing bound (password verification), hence larger.
export const BUDGET = { auth: 800, read: 300, write: 500 };

const LENIENT = 60000;

/**
 * Build the threshold map.
 * @param {object} options
 * @param {'strict'|'lenient'} [options.profile] strict = the SLOs; lenient = no pass/fail on latency
 *   (stress, where the goal is to find the knee), the per-endpoint metrics are still produced.
 * @param {number} [options.readMs] override of the read p95 budget (spike)
 * @param {number} [options.writeMs] override of the write p95 budget (spike)
 * @param {number} [options.errorRate] max http_req_failed rate
 * @param {object} [options.extra] merged last
 */
export function thresholds(options = {}) {
  const { profile = 'strict', readMs = BUDGET.read, writeMs = BUDGET.write, errorRate = 0.01, extra = {} } = options;
  const budget = { auth: BUDGET.auth, read: readMs, write: writeMs };
  const result = {
    http_req_failed: [`rate<${errorRate}`],
    checks: ['rate>0.99'],
  };

  if (profile === 'strict') {
    for (const kind of Object.keys(budget)) {
      result[`http_req_duration{kind:${kind}}`] = [`p(95)<${budget[kind]}`];
    }
  }
  for (const [name, kind] of Object.entries(ENDPOINTS)) {
    const limit = profile === 'strict' ? budget[kind] : LENIENT;
    result[`http_req_duration{name:${name}}`] = [`p(95)<${limit}`];
    result[`http_reqs{name:${name}}`] = ['count>=0']; // makes the per-endpoint request count appear in the report
  }

  return { ...result, ...extra };
}
