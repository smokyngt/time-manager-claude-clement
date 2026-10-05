// Soak: moderate constant load for 30 minutes (default) to expose leaks, pool exhaustion, token
// expiry handling (access tokens last 15 min: every VU re-logins once or twice) and slow drift.
//   k6 run -e BASE_URL=... -e SOAK_VUS=20 -e SOAK_DURATION=30m ops/load/soak.js
import { summarize } from './lib/summary.js';
import { thresholds } from './lib/thresholds.js';
import { mixedJourney, prepare } from './lib/workload.js';

export const options = {
  scenarios: {
    soak: {
      executor: 'ramping-vus',
      startVUs: 0,
      gracefulRampDown: '15s',
      stages: [
        { duration: '1m', target: Number(__ENV.SOAK_VUS || 20) },
        { duration: __ENV.SOAK_DURATION || '30m', target: Number(__ENV.SOAK_VUS || 20) },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: thresholds(),
  tags: { scenario: 'soak' },
};

export const setup = prepare;

export default function (data) {
  mixedJourney(data);
}

export const handleSummary = (data) => summarize(data, 'soak');
