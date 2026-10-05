// Spike: sudden 10x surge, then back to baseline, to check the API absorbs the burst and recovers.
//   k6 run -e BASE_URL=... -e BASE_VUS=10 -e SPIKE_VUS=100 ops/load/spike.js
import { summarize } from './lib/summary.js';
import { thresholds } from './lib/thresholds.js';
import { mixedJourney, prepare } from './lib/workload.js';

const base = Number(__ENV.BASE_VUS || 10);
const peak = Number(__ENV.SPIKE_VUS || 100);

export const options = {
  setupTimeout: '5m', // 14 logins; slow when AUTH_LOGIN_RATE_LIMIT_MAX is left at its default of 10/min
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: base,
      gracefulRampDown: '15s',
      stages: [
        { duration: '1m', target: base }, // baseline
        { duration: '10s', target: peak }, // surge
        { duration: '1m', target: peak }, // peak
        { duration: '10s', target: base }, // drop
        { duration: '2m', target: base }, // recovery
        { duration: '15s', target: 0 },
      ],
    },
  },
  // The surge may degrade latency, but errors must stay under 1% and the API must recover:
  // budgets are doubled compared to the SLOs.
  thresholds: thresholds({ readMs: 600, writeMs: 1000 }),
  tags: { scenario: 'spike' },
};

export const setup = prepare;

export default function (data) {
  mixedJourney(data);
}

export const handleSummary = (data) => summarize(data, 'spike');
