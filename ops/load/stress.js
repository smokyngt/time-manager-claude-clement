// Stress: open model (ramping-arrival-rate) stepping the iteration rate up until the API breaks,
// to find the knee: the rate where p95 leaves its budget, errors appear or iterations get dropped.
//   k6 run -e BASE_URL=... -e START_RATE=10 -e STEP_RATE=20 -e STEPS=10 -e STEP_DURATION=1m ops/load/stress.js
// Latency thresholds are lenient on purpose; the run aborts when the API is clearly down
// (error rate > 10%) and the report shows where the budget was exceeded.
import { summarize } from './lib/summary.js';
import { thresholds } from './lib/thresholds.js';
import { mixedJourney, prepare } from './lib/workload.js';

const start = Number(__ENV.START_RATE || 10);
const step = Number(__ENV.STEP_RATE || 20);
const steps = Number(__ENV.STEPS || 10);
const stepDuration = __ENV.STEP_DURATION || '1m';

const stages = [];
for (let i = 0; i < steps; i += 1) {
  const rate = start + step * i;
  stages.push({ duration: '15s', target: rate }, { duration: stepDuration, target: rate });
}
stages.push({ duration: '30s', target: 0 });

export const options = {
  setupTimeout: '5m', // 14 logins; slow when AUTH_LOGIN_RATE_LIMIT_MAX is left at its default of 10/min
  scenarios: {
    stress: {
      executor: 'ramping-arrival-rate',
      startRate: start,
      timeUnit: '1s',
      preAllocatedVUs: Number(__ENV.PRE_VUS || 100),
      maxVUs: Number(__ENV.MAX_VUS || 1000),
      stages,
    },
  },
  thresholds: thresholds({
    profile: 'lenient',
    extra: {
      http_req_failed: [{ threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '30s' }],
      checks: ['rate>0.90'],
    },
  }),
  tags: { scenario: 'stress' },
};

export function setup() {
  return prepare();
}

export default function (data) {
  mixedJourney(data);
}

export const handleSummary = (data) => summarize(data, 'stress');
