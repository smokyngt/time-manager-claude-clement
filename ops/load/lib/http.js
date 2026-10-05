import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

import { BASE_URL, PASSWORD } from './config.js';
import { ENDPOINTS } from './thresholds.js';

// Business conflicts (clock in while already in, ...) are expected when several VUs share an
// account: they are counted here instead of polluting http_req_failed.
export const clockConflicts = new Counter('clock_conflicts');

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };

/** Authorization + JSON headers. */
export function authHeaders(token) {
  return token ? { ...JSON_HEADERS, Authorization: `Bearer ${token}` } : { ...JSON_HEADERS };
}

/**
 * Perform a request tagged by endpoint name (never by URL, to keep cardinality at zero).
 * @param {string} name key of ENDPOINTS, e.g. 'clocks.in'
 * @param {string} method GET | POST
 * @param {string} path path under BASE_URL, e.g. '/v1/clocks/in'
 * @param {object|null} body JSON body
 * @param {string|null} token access token
 * @param {number[]} [expected] additional status codes that are not failures
 */
export function call(name, method, path, body, token, expected = []) {
  const kind = ENDPOINTS[name];
  if (!kind) throw new Error(`unregistered endpoint tag: ${name}`);
  const params = {
    headers: authHeaders(token),
    tags: { name, kind },
    responseCallback: http.expectedStatuses(200, 201, ...expected),
  };
  const url = `${BASE_URL}${path}`;
  if (method === 'GET') return http.get(url, params);
  return http.post(url, body === null ? '{}' : JSON.stringify(body), params);
}

/** Parse a JSON body, null when it is not JSON. */
export function json(res) {
  try {
    return res.json();
  } catch (_) {
    return null;
  }
}

/**
 * Check the success envelope `{ data, event }` and return `data`.
 * @param {object} res k6 response
 * @param {string} name endpoint name, used as check prefix
 * @param {number} [status] expected status
 */
export function checkEnvelope(res, name, status = 200) {
  const body = json(res);
  check(res, {
    [`${name}: status ${status}`]: (r) => r.status === status,
    [`${name}: envelope { data, event }`]: () =>
      body !== null && typeof body === 'object' && 'data' in body && typeof body.event === 'string',
  });
  return body && body.data !== undefined ? body.data : null;
}

/** Check a paginated list `data: { items, more, next, total }`. */
export function checkPage(res, name) {
  const data = checkEnvelope(res, name);
  check(data, {
    [`${name}: page shape`]: (d) => d !== null && Array.isArray(d.items) && 'more' in d && 'total' in d,
  });
  return data;
}

/**
 * Check the error envelope `{ code, message, status, request_id }`.
 * Used for clock conflicts.
 */
export function checkError(res, name, status) {
  const body = json(res);
  check(res, {
    [`${name}: error ${status}`]: (r) => r.status === status,
    [`${name}: error envelope`]: () =>
      body !== null && typeof body.code === 'string' && body.status === status,
  });
  return body;
}

export { PASSWORD };
