// Smoke: 1 VU for 30 s, touches every main endpoint once per iteration. Run before anything else.
//   k6 run -e BASE_URL=http://localhost:8000 ops/load/smoke.js
import { sleep } from 'k6';

import { tokenFor } from './lib/auth.js';
import { DAY_MS, EMPLOYEES, MANAGERS } from './lib/config.js';
import { call, checkEnvelope, checkError, checkPage, clockConflicts } from './lib/http.js';
import { summarize } from './lib/summary.js';
import { thresholds } from './lib/thresholds.js';
import { prepare } from './lib/workload.js';

export const options = {
  scenarios: {
    smoke: { executor: 'constant-vus', vus: 1, duration: '30s' },
  },
  thresholds: thresholds(),
  tags: { scenario: 'smoke' },
};

export function setup() {
  const data = prepare();
  checkEnvelope(call('auth.me', 'GET', '/v1/auth/me', null, data.sessions[MANAGERS[0]].token), 'auth.me');
  return data;
}

export default function (data) {
  const manager = MANAGERS[__ITER % MANAGERS.length];
  const employee = EMPLOYEES[__ITER % EMPLOYEES.length];
  const managerToken = tokenFor(data, manager);
  const employeeToken = tokenFor(data, employee);
  const employeeId = data.sessions[employee].userId;
  const now = Date.now();
  const range = { from: now - 30 * DAY_MS, to: now, granularity: 'week' };

  // Liveness (no auth, no envelope).
  call('health', 'GET', '/health', null, null);

  // Identity.
  const me = checkEnvelope(call('auth.me', 'GET', '/v1/auth/me', null, employeeToken), 'auth.me');
  if (me && me.id !== undefined && me.id !== employeeId) throw new Error('auth.me returned another user');

  // Manager: users and teams.
  const users = checkPage(call('users.list', 'POST', '/v1/users/list', { limit: 10 }, managerToken), 'users.list');
  if (users && users.items.length > 0) {
    checkEnvelope(call('users.retrieve', 'GET', `/v1/users/${users.items[0].id}`, null, managerToken), 'users.retrieve');
  }
  const teams = checkPage(call('teams.list', 'POST', '/v1/teams/list', { limit: 10 }, managerToken), 'teams.list');
  const teamId = data.teams[manager][0] || (teams && teams.items[0] && teams.items[0].id);
  if (teamId) {
    checkEnvelope(call('teams.retrieve', 'GET', `/v1/teams/${teamId}`, null, managerToken), 'teams.retrieve');
    checkPage(call('teams.members.list', 'POST', `/v1/teams/${teamId}/members/list`, { limit: 10 }, managerToken), 'teams.members.list');
    checkEnvelope(call('reports.team', 'POST', '/v1/reports/team', { team_id: teamId, ...range }, managerToken), 'reports.team');
  }

  // Employee: clock in or out depending on the current state, then read back.
  const current = checkEnvelope(call('clocks.current', 'GET', '/v1/clocks/current', null, employeeToken), 'clocks.current');
  const open = current !== null && current.clock !== null && current.clock !== undefined;
  const name = open ? 'clocks.out' : 'clocks.in';
  const res = call(name, 'POST', `/v1/clocks/${open ? 'out' : 'in'}`, {}, employeeToken, [409]);
  if (res.status === 409) {
    clockConflicts.add(1);
    checkError(res, name, 409);
  } else {
    checkEnvelope(res, name);
  }
  checkPage(call('clocks.list', 'POST', '/v1/clocks/list', { limit: 10 }, employeeToken), 'clocks.list');
  checkEnvelope(call('reports.user', 'POST', '/v1/reports/user', { user_id: employeeId, ...range }, employeeToken), 'reports.user');

  sleep(1);
}

export const handleSummary = (data) => summarize(data, 'smoke');
