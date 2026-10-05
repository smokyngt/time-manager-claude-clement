import { sleep } from 'k6';

import { ALL_ACCOUNTS, PASSWORD } from './config.js';
import { call, checkEnvelope, json } from './http.js';
import { Counter } from 'k6/metrics';

export const loginRetries = new Counter('login_retries');

// Per VU state (each VU has its own module instance): sessions it logged in by itself.
const own = {};
// Refresh margin (ms) before token expiry, jittered per VU so VUs do not re-login together.
const margin = 30000 + Math.random() * 120000;

/**
 * POST /v1/auth/login. Retries on 429 (login rate limit) honouring Retry-After.
 * Returns { token, userId, role, expiresAt } or null.
 */
export function login(email, password = PASSWORD) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const res = call('auth.login', 'POST', '/v1/auth/login', { email, password }, null, [429]);
    if (res.status === 429) {
      loginRetries.add(1);
      const wait = Number(res.headers['Retry-After']) || 5 + attempt * 2;
      sleep(Math.min(wait, 30) + Math.random());
      continue;
    }
    const data = checkEnvelope(res, 'auth.login');
    if (!data || !data.access_token) return null;
    return {
      token: data.access_token,
      userId: data.user && data.user.id,
      role: data.user && data.user.role,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  }
  return null;
}

/**
 * setup() helper: log in each account exactly once and collect ids. Shared with every VU through
 * the setup data, so a 50 VU test costs 14 logins and not 50.
 */
export function openSessions(emails = ALL_ACCOUNTS) {
  const sessions = {};
  for (const email of emails) {
    const session = login(email);
    if (session === null) throw new Error(`login failed for ${email}; is the demo data seeded?`);
    sessions[email] = session;
  }
  return sessions;
}

/**
 * Token for `email`: the shared setup session while valid, otherwise a VU-local re-login
 * (once per ~15 min). Never logs in per iteration.
 */
export function tokenFor(data, email) {
  let session = own[email] || data.sessions[email];
  if (session === undefined || Date.now() > session.expiresAt - margin) {
    const fresh = login(email);
    if (fresh !== null) {
      own[email] = fresh;
      session = fresh;
    }
  }
  return session.token;
}

export { json };
