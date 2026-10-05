// Load: ramp to 50 VUs over 5 minutes (40 employees + 10 managers), hold, ramp down.
//   k6 run -e BASE_URL=http://localhost:8000 ops/load/load.js
// Override: -e VUS_EMPLOYEES=40 -e VUS_MANAGERS=10 -e HOLD=2m
import { EMPLOYEES, MANAGERS } from './lib/config.js';
import { summarize } from './lib/summary.js';
import { thresholds } from './lib/thresholds.js';
import { accountOf, employeeJourney, managerJourney, prepare } from './lib/workload.js';

const employeeVus = Number(__ENV.VUS_EMPLOYEES || 40);
const managerVus = Number(__ENV.VUS_MANAGERS || 10);
const hold = __ENV.HOLD || '2m';

const stages = (target) => [
  { duration: '5m', target },
  { duration: hold, target },
  { duration: '30s', target: 0 },
];

export const options = {
  scenarios: {
    employees: { executor: 'ramping-vus', exec: 'employees', startVUs: 0, stages: stages(employeeVus), gracefulRampDown: '15s' },
    managers: { executor: 'ramping-vus', exec: 'managers', startVUs: 0, stages: stages(managerVus), gracefulRampDown: '15s' },
  },
  thresholds: thresholds(),
  tags: { scenario: 'load' },
};

export const setup = prepare;

// A VU runs one scenario for its whole life, so its account is stable per scenario.
export function employees(data) {
  employeeJourney(data, accountOf(EMPLOYEES));
}

export function managers(data) {
  managerJourney(data, accountOf(MANAGERS));
}

export const handleSummary = (data) => summarize(data, 'load');
