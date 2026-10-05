import { describe, expect, test } from 'bun:test';

import { AuthenticationError, NetworkError, NotFoundError } from '../errors.js';
import { HttpClient } from '../http.js';
import { envelope, fakeFetch, problem } from './support.js';

const session = {
  access_token: 'new-token',
  expires_in: 900,
  scopes: [],
  token_type: 'Bearer',
  user: {},
};

describe('HttpClient', () => {
  test('unwraps the envelope, sends bearer, credentials and snake_case body', async () => {
    const { calls, fetch } = fakeFetch(() => envelope({ some_value: 1 }));
    const http = new HttpClient({ baseUrl: 'http://api/', fetch, getToken: () => 'tok' });

    const data = await http.post<{ someValue: number }>('/v1/x', { firstName: 'a' });

    expect(data).toEqual({ someValue: 1 });
    const call = calls[0];
    expect(call?.url).toBe('http://api/v1/x');
    expect(call?.init.credentials).toBe('include');
    expect(call?.headers.Authorization).toBe('Bearer tok');
    expect(call?.headers['Content-Type']).toBe('application/json');
    expect(call?.body).toEqual({ first_name: 'a' });
  });

  test('omits Authorization without a token and body on GET', async () => {
    const { calls, fetch } = fakeFetch(() => envelope({}));
    const http = new HttpClient({ baseUrl: '', fetch, getToken: () => null });
    await http.get('/v1/x');
    expect(calls[0]?.headers.Authorization).toBeUndefined();
    expect(calls[0]?.init.body).toBeUndefined();
  });

  test('throws a mapped error', async () => {
    const { fetch } = fakeFetch(() => problem(404, 'team.not.found'));
    const http = new HttpClient({ baseUrl: '', fetch, getToken: () => null });
    const error = await http.get('/v1/teams/1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as NotFoundError).code).toBe('team.not.found');
    expect((error as NotFoundError).correlationId).toBe('cid');
  });

  test('times out with NetworkError isTimeout', async () => {
    const { fetch } = fakeFetch(
      (call) =>
        new Promise<Response>((_resolve, reject) => {
          call.init.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    );
    const http = new HttpClient({ baseUrl: '', fetch, getToken: () => null, timeoutMs: 20 });
    const error = await http.get('/v1/slow').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).isTimeout).toBe(true);
  });

  test('wraps fetch failures in NetworkError', async () => {
    const { fetch } = fakeFetch(() => {
      throw new TypeError('offline');
    });
    const http = new HttpClient({ baseUrl: '', fetch, getToken: () => null });
    const error = await http.get('/v1/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).isTimeout).toBe(false);
  });

  test('refreshes once, shared by concurrent 401s, then retries each call', async () => {
    let token = 'old';
    let refreshes = 0;
    const stored: string[] = [];
    const { calls, fetch } = fakeFetch(async (call) => {
      if (call.url.endsWith('/v1/auth/refresh')) {
        refreshes += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));

        return envelope(session);
      }
      if (call.headers.Authorization === 'Bearer old') {
        return problem(401, 'token.authentication.failed');
      }

      return envelope({ ok: true });
    });
    const http = new HttpClient({
      baseUrl: '',
      fetch,
      getToken: () => token,
      onTokenRefresh: (value) => {
        token = value;
        stored.push(value);
      },
    });

    const results = await Promise.all([http.get('/v1/a'), http.get('/v1/b'), http.get('/v1/c')]);

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshes).toBe(1);
    expect(stored).toEqual(['new-token']);
    expect(calls.filter((c) => c.headers.Authorization === 'Bearer new-token')).toHaveLength(3);
    expect(calls.find((c) => c.url.endsWith('/refresh'))?.init.credentials).toBe('include');
  });

  test('retries only once when the retry still returns 401', async () => {
    const { calls, fetch } = fakeFetch((call) =>
      call.url.endsWith('/refresh')
        ? envelope(session)
        : problem(401, 'token.authentication.failed'),
    );
    const http = new HttpClient({ baseUrl: '', fetch, getToken: () => 't' });
    const error = await http.get('/v1/a').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(calls.filter((c) => c.url.endsWith('/v1/a'))).toHaveLength(2);
  });

  test('logs out and throws AuthenticationError when refresh fails', async () => {
    let logouts = 0;
    const { fetch } = fakeFetch((call) =>
      call.url.endsWith('/refresh')
        ? problem(401, 'auth.session.invalid')
        : problem(401, 'token.authentication.failed'),
    );
    const http = new HttpClient({
      baseUrl: '',
      fetch,
      getToken: () => 't',
      onLogout: () => {
        logouts += 1;
      },
    });
    const results = await Promise.allSettled([http.get('/v1/a'), http.get('/v1/b')]);
    for (const result of results) {
      expect(result.status).toBe('rejected');
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(AuthenticationError);
    }
    expect(logouts).toBe(1);
  });

  test('does not try to refresh on login failures or other 401 codes', async () => {
    const { calls, fetch } = fakeFetch(() => problem(401, 'auth.invalid.credentials'));
    const http = new HttpClient({ baseUrl: '', fetch, getToken: () => null });
    const error = await http.post('/v1/auth/login', { email: 'a' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(calls).toHaveLength(1);
  });
});
