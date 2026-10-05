import { sleep } from 'k6';

import { openSessions, tokenFor } from './auth.js';
import { ALL_ACCOUNTS, DAY_MS, EMPLOYEES, MANAGERS, THINK } from './config.js';
import { call, checkEnvelope, checkError, checkPage, clockConflicts } from './http.js';

// Real, role-based user journeys shared by every scenario.

/**
 * setup(): log in once per demo account and discover the teams each manager manages.
 * Returns plain JSON, handed to every VU.
 */
/** @param {string[]} [accounts] demo accounts to log in (default: all 14) */
export function prepare(accounts = ALL_ACCOUNTS) {
  const sessions = openSessions(accounts);
  const teams = {};
  for (const email of MANAGERS.filter((account) => accounts.includes(account))) {
    const res = call('teams.list', 'POST', '/v1/teams/list', { limit: 100 }, sessions[email].token);
    const page = checkPage(res, 'teams.list');
    teams[email] = ((page && page.items) || [])
      .filter((team) => team.manager_id === sessions[email].userId)
      .map((team) => team.id);
  }
  return { sessions, teams };
}

let think = THINK;

/** Override the think time of this VU (open models such as stress run without it). */
export function setThink(seconds) {
  think = seconds;
}

export function pause(min = 0.5, max = 1.5) {
  if (think > 0) sleep((min + Math.random() * (max - min)) * think);
}

/** Pick the account of this VU in a list, stable for the whole run. */
export function accountOf(list) {
  return list[(__VU - 1) % list.length];
}

/** Employee: toggle the clock (in if out, out if in) then look at their own numbers. */
export function employeeJourney(data, email) {
  const token = tokenFor(data, email);
  const me = data.sessions[email];

  const current = checkEnvelope(call('clocks.current', 'GET', '/v1/clocks/current', null, token), 'clocks.current');
  const open = current !== null && current.clock !== null && current.clock !== undefined;

  const toggle = open ? 'clocks.out' : 'clocks.in';
  const res = call(toggle, 'POST', `/v1/clocks/${open ? 'out' : 'in'}`, {}, token, [409]);
  if (res.status === 409) {
    // Another VU sharing this account toggled first: a legitimate business conflict.
    clockConflicts.add(1);
    checkError(res, toggle, 409);
  } else {
    checkEnvelope(res, toggle);
  }
  pause();

  const now = Date.now();
  const report = call(
    'reports.user',
    'POST',
    '/v1/reports/user',
    { user_id: me.userId, from: now - 30 * DAY_MS, to: now, granularity: 'week' },
    token,
  );
  checkEnvelope(report, 'reports.user');
  pause();

  checkPage(call('clocks.list', 'POST', '/v1/clocks/list', { limit: 25 }, token), 'clocks.list');
}

/** Manager: browse people and teams, then read a team report. */
export function managerJourney(data, email) {
  const token = tokenFor(data, email);

  checkPage(call('users.list', 'POST', '/v1/users/list', { limit: 25 }, token), 'users.list');
  pause();
  checkPage(call('teams.list', 'POST', '/v1/teams/list', { limit: 25 }, token), 'teams.list');
  pause();

  const teamIds = data.teams[email] || [];
  if (teamIds.length > 0) {
    const teamId = teamIds[Math.floor(Math.random() * teamIds.length)];
    const now = Date.now();
    checkEnvelope(
      call(
        'reports.team',
        'POST',
        '/v1/reports/team',
        { team_id: teamId, from: now - 30 * DAY_MS, to: now, granularity: 'week' },
        token,
      ),
      'reports.team',
    );
    pause();
    checkPage(
      call('teams.members.list', 'POST', `/v1/teams/${teamId}/members/list`, { limit: 25 }, token),
      'teams.members.list',
    );
  }
}

/** Open workload (stress, spike, soak): 85% employee journeys, 15% manager journeys. */
export function mixedJourney(data) {
  if (Math.random() < 0.85) {
    const email = EMPLOYEES[Math.floor(Math.random() * EMPLOYEES.length)];
    employeeJourney(data, email);
  } else {
    const email = MANAGERS[Math.floor(Math.random() * MANAGERS.length)];
    managerJourney(data, email);
  }
}
