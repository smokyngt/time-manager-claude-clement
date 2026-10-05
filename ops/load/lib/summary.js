import { SUMMARY_DIR } from './config.js';
import { ENDPOINTS } from './thresholds.js';

const ms = (value) => (value === undefined ? '-' : `${value.toFixed(1)} ms`);
const num = (value, digits = 2) => (value === undefined ? '-' : Number(value).toFixed(digits));
const pct = (value) => (value === undefined ? '-' : `${(value * 100).toFixed(2)}%`);

function values(data, key) {
  const metric = data.metrics[key];
  return metric ? metric.values || metric : undefined;
}

function thresholdRows(data) {
  const rows = [];
  for (const [key, metric] of Object.entries(data.metrics)) {
    if (!metric.thresholds) continue;
    if (key.startsWith('http_reqs{')) continue; // bookkeeping thresholds, see lib/thresholds.js
    for (const [expr, result] of Object.entries(metric.thresholds)) {
      const ok = typeof result === 'object' ? result.ok : !result;
      rows.push({ key, expr, ok });
    }
  }
  return rows;
}

/** Markdown report, written to <SUMMARY_DIR>/<scenario>-summary.md and appended to the GitHub job summary. */
export function markdown(data, scenario) {
  const duration = values(data, 'http_req_duration') || {};
  const failed = values(data, 'http_req_failed') || {};
  const checks = values(data, 'checks') || {};
  const reqs = values(data, 'http_reqs') || {};
  const iterations = values(data, 'iterations') || {};
  const dropped = values(data, 'dropped_iterations');
  const conflicts = values(data, 'clock_conflicts');
  const vus = values(data, 'vus_max');
  const rows = thresholdRows(data);
  const failing = rows.filter((row) => !row.ok);
  // A run that issued no request (setup() crashed, API down) must never read as a pass.
  const empty = !reqs.count;
  const lines = [];

  lines.push(`## k6 ${scenario}: ${failing.length === 0 && !empty ? 'PASS' : 'FAIL'}${empty ? ' (no request was issued, see the k6 log)' : ''}`, '');
  lines.push(`Run at ${new Date().toISOString()}, test duration ${num((data.state.testRunDurationMs || 0) / 1000, 0)} s.`, '');
  lines.push('| Metric | Value |', '|---|---|');
  lines.push(`| Requests | ${reqs.count ?? '-'} (${num(reqs.rate)} req/s) |`);
  lines.push(`| Iterations | ${iterations.count ?? '-'} (${num(iterations.rate)} /s) |`);
  lines.push(`| Max VUs | ${vus ? vus.max : '-'} |`);
  lines.push(`| Error rate (http_req_failed) | ${pct(failed.rate)} |`);
  lines.push(`| Checks passed | ${pct(checks.rate)} (${checks.passes ?? 0} ok, ${checks.fails ?? 0} ko) |`);
  lines.push(`| Latency p50 / p90 / p95 / p99 | ${ms(duration.med)} / ${ms(duration['p(90)'])} / ${ms(duration['p(95)'])} / ${ms(duration['p(99)'])} |`);
  if (dropped) lines.push(`| Dropped iterations (saturation) | ${dropped.count} |`);
  if (conflicts) lines.push(`| Clock conflicts (409, expected, shared accounts) | ${conflicts.count} |`);

  lines.push('', '### Latency by endpoint', '', '| Endpoint | Kind | Requests | avg | p95 | p99 | max |', '|---|---|---|---|---|---|---|');
  for (const [name, kind] of Object.entries(ENDPOINTS)) {
    const v = values(data, `http_req_duration{name:${name}}`);
    const count = values(data, `http_reqs{name:${name}}`);
    if (!v || !count || count.count === 0) continue;
    lines.push(`| \`${name}\` | ${kind} | ${count ? count.count : '-'} | ${ms(v.avg)} | ${ms(v['p(95)'])} | ${ms(v['p(99)'])} | ${ms(v.max)} |`);
  }

  lines.push('', '### Thresholds', '', '| Metric | Threshold | Result |', '|---|---|---|');
  for (const row of rows) lines.push(`| \`${row.key}\` | \`${row.expr}\` | ${row.ok ? 'pass' : '**FAIL**'} |`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Standard handleSummary: JSON + markdown files, markdown on stdout.
 * Usage in a scenario: `export const handleSummary = (data) => summarize(data, 'smoke');`
 */
export function summarize(data, scenario) {
  const report = markdown(data, scenario);
  return {
    stdout: `${report}\n`,
    [`${SUMMARY_DIR}/${scenario}-summary.json`]: JSON.stringify(data, null, 2),
    [`${SUMMARY_DIR}/${scenario}-summary.md`]: report,
  };
}
