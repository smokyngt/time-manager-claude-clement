import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import { caught, makeRow, OTHER_ID } from '../../../helpers/fixtures.js';

const realDb = { ...(await import('@/db/client.js')) };
const realLog = { ...(await import('@/services/log/index.js')) };
const fakeDb = new FakeDb();
const logCreate = mock(() => Promise.resolve({ success: true }));
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));
await mock.module('@/services/log/index.js', () => ({
  ...realLog,
  logService: { create: logCreate },
}));

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
  void mock.module('@/services/log/index.js', () => realLog);
});

afterEach(() => {
  mock.clearAllMocks();
  fakeDb.reset();
});

import { SignJWT } from 'jose';

const { authorize } = await import('@/services/auth/authorize.js');
const { callback } = await import('@/services/auth/callback.js');

const TENANT = '11111111-2222-4333-8444-555555555555';
const saved = { ...process.env };
const realFetch = globalThis.fetch;

const configure = (): void => {
  process.env['MICROSOFT_CLIENT_ID'] = 'client-id';
  process.env['MICROSOFT_CLIENT_SECRET'] = 'client-secret';
  process.env['MICROSOFT_TENANT_ID'] = TENANT;
};

afterAll(() => {
  process.env = saved;
  globalThis.fetch = realFetch;
});

afterEach(() => {
  delete process.env['MICROSOFT_CLIENT_ID'];
  delete process.env['MICROSOFT_CLIENT_SECRET'];
  delete process.env['MICROSOFT_TENANT_ID'];
  globalThis.fetch = realFetch;
});

const idToken = async (claims: Record<string, unknown>): Promise<string> =>
  new SignJWT({ iss: `https://login.microsoftonline.com/${TENANT}/v2.0`, tid: TENANT, ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience('client-id')
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode('irrelevant-secret-irrelevant-secret'));

const start = async (): Promise<{ cookie: string; nonce: string; state: string }> => {
  const result = await authorize();
  const url = new URL(result.url);
  return {
    cookie: result.state_cookie,
    nonce: url.searchParams.get('nonce') ?? '',
    state: url.searchParams.get('state') ?? '',
  };
};

const respondWith = (token: string, ok = true): void => {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(JSON.stringify({ id_token: token }), { status: ok ? 200 : 400 })),
  ) as unknown as typeof fetch;
};

describe('auth.service.authorize', () => {
  it('returns 503 when Microsoft is not configured', async () => {
    const error = await caught(authorize());
    expect(error.code).toBe('AUTH_MICROSOFT_UNAVAILABLE');
    expect(error.status).toBe(503);
  });

  it('returns 503 when the tenant is missing or a multi-tenant alias', async () => {
    configure();
    for (const tenant of [undefined, 'common', 'organizations', 'consumers']) {
      if (tenant === undefined) delete process.env['MICROSOFT_TENANT_ID'];
      else process.env['MICROSOFT_TENANT_ID'] = tenant;
      const error = await caught(authorize());
      expect(error.code).toBe('AUTH_MICROSOFT_UNAVAILABLE');
    }
  });

  it('builds an authorization code + PKCE url and a signed state cookie', async () => {
    configure();
    const result = await authorize();
    const url = new URL(result.url);
    expect(url.origin + url.pathname).toBe(
      `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`,
    );
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(result.state_cookie.split('.')).toHaveLength(3);
    expect(result.max_age).toBe(600);
  });
});

describe('auth.service.callback', () => {
  it('returns 503 when Microsoft is not configured', async () => {
    const error = await caught(callback({ code: 'c', state: 's', state_cookie: 'x' }));
    expect(error.code).toBe('AUTH_MICROSOFT_UNAVAILABLE');
  });

  it('rejects a missing or mismatching state', async () => {
    configure();
    const flow = await start();
    const missing = await caught(
      callback({ code: 'c', state: flow.state, state_cookie: undefined }),
    );
    const mismatch = await caught(
      callback({ code: 'c', state: 'other', state_cookie: flow.cookie }),
    );
    expect(missing.code).toBe('AUTH_MICROSOFT_REJECTED');
    expect(mismatch.code).toBe('AUTH_MICROSOFT_REJECTED');
  });

  it('rejects when the token endpoint refuses the code', async () => {
    configure();
    const flow = await start();
    respondWith('x', false);
    const error = await caught(
      callback({ code: 'c', state: flow.state, state_cookie: flow.cookie }),
    );
    expect(error.code).toBe('AUTH_MICROSOFT_REJECTED');
  });

  it('rejects a nonce mismatch', async () => {
    configure();
    const flow = await start();
    respondWith(await idToken({ email: 'jane.doe@example.com', nonce: 'wrong', oid: 'oid-1' }));
    const error = await caught(
      callback({ code: 'c', state: flow.state, state_cookie: flow.cookie }),
    );
    expect(error.code).toBe('AUTH_MICROSOFT_REJECTED');
  });

  it('links an existing user by email and issues a session', async () => {
    configure();
    const flow = await start();
    respondWith(await idToken({ email: 'Jane.Doe@Example.com', nonce: flow.nonce, oid: 'oid-1' }));
    fakeDb.enqueue([], [makeRow()], [makeRow({ microsoft_id: `${TENANT}:oid-1` })], []);
    const session = await callback({ code: 'c', state: flow.state, state_cookie: flow.cookie });
    expect(session.user.id).toBe(OTHER_ID);
    expect((fakeDb.arg('update', 'set') as Record<string, unknown>)['microsoft_id']).toBe(
      `${TENANT}:oid-1`,
    );
    const events = (logCreate.mock.calls as unknown as [{ event: string }][]).map(
      ([entry]) => entry.event,
    );
    expect(events).toEqual(['auth.microsoft_linked', 'auth.logged_in']);
  });

  it('signs in a user already linked by oid without relinking', async () => {
    configure();
    const flow = await start();
    respondWith(await idToken({ nonce: flow.nonce, oid: 'oid-1' }));
    fakeDb.enqueue([makeRow({ microsoft_id: `${TENANT}:oid-1` })], []);
    const session = await callback({ code: 'c', state: flow.state, state_cookie: flow.cookie });
    expect(session.user.id).toBe(OTHER_ID);
    expect(fakeDb.calls.some((call) => call.op === 'update')).toBe(false);
  });

  it('never creates unknown users', async () => {
    configure();
    const flow = await start();
    respondWith(await idToken({ email: 'stranger@example.com', nonce: flow.nonce, oid: 'oid-2' }));
    fakeDb.enqueue([], []);
    const error = await caught(
      callback({ code: 'c', state: flow.state, state_cookie: flow.cookie }),
    );
    expect(error.code).toBe('AUTH_MICROSOFT_UNKNOWN_USER');
    expect(error.status).toBe(403);
    expect(fakeDb.calls.some((call) => call.op === 'insert')).toBe(false);
  });

  it('refuses an email already linked to another Microsoft identity and archived users', async () => {
    configure();
    const flow = await start();
    respondWith(await idToken({ email: 'jane.doe@example.com', nonce: flow.nonce, oid: 'oid-3' }));
    fakeDb.enqueue([], [makeRow({ microsoft_id: 'someone-else' })]);
    const other = await caught(
      callback({ code: 'c', state: flow.state, state_cookie: flow.cookie }),
    );
    fakeDb.enqueue([makeRow({ archived_at: 1, microsoft_id: `${TENANT}:oid-3` })]);
    const archived = await caught(
      callback({ code: 'c', state: flow.state, state_cookie: flow.cookie }),
    );
    expect(other.code).toBe('AUTH_MICROSOFT_REJECTED');
    expect(archived.code).toBe('AUTH_MICROSOFT_REJECTED');
  });
  it('rejects an id token issued by another tenant', async () => {
    configure();
    const flow = await start();
    const other = '99999999-2222-4333-8444-555555555555';
    respondWith(
      await idToken({
        email: 'jane.doe@example.com',
        iss: `https://login.microsoftonline.com/${other}/v2.0`,
        nonce: flow.nonce,
        oid: 'oid-1',
        tid: other,
      }),
    );
    fakeDb.enqueue([makeRow()], []);
    const error = await caught(
      callback({ code: 'c', state: flow.state, state_cookie: flow.cookie }),
    );
    expect(error.code).toBe('AUTH_MICROSOFT_REJECTED');
    expect(fakeDb.calls).toHaveLength(0);
  });

  it('rejects a missing tid, a missing oid and a mismatching issuer', async () => {
    configure();
    const flow = await start();
    const attempts = [
      { tid: undefined },
      { oid: undefined },
      { iss: 'https://login.microsoftonline.com/other/v2.0' },
    ];
    for (const attempt of attempts) {
      respondWith(
        await idToken({
          email: 'jane.doe@example.com',
          nonce: flow.nonce,
          oid: 'oid-1',
          ...attempt,
        }),
      );
      const error = await caught(
        callback({ code: 'c', state: flow.state, state_cookie: flow.cookie }),
      );
      expect(error.code).toBe('AUTH_MICROSOFT_REJECTED');
    }
    expect(fakeDb.calls).toHaveLength(0);
  });

  it('never links by preferred_username', async () => {
    configure();
    const flow = await start();
    respondWith(
      await idToken({
        nonce: flow.nonce,
        oid: 'oid-1',
        preferred_username: 'jane.doe@example.com',
      }),
    );
    fakeDb.enqueue([], []);
    const error = await caught(
      callback({ code: 'c', state: flow.state, state_cookie: flow.cookie }),
    );
    expect(error.code).toBe('AUTH_MICROSOFT_UNKNOWN_USER');
    expect(fakeDb.calls.filter((call) => call.op === 'select' && call.method === 'from')).toHaveLength(
      1,
    );
    expect(fakeDb.calls.some((call) => call.op === 'update')).toBe(false);
  });

  it('does not take over a user already linked to another identity', async () => {
    configure();
    const flow = await start();
    respondWith(await idToken({ email: 'jane.doe@example.com', nonce: flow.nonce, oid: 'oid-9' }));
    fakeDb.enqueue([], [makeRow({ microsoft_id: `${TENANT}:oid-1` })]);
    const error = await caught(
      callback({ code: 'c', state: flow.state, state_cookie: flow.cookie }),
    );
    expect(error.code).toBe('AUTH_MICROSOFT_REJECTED');
    expect(fakeDb.calls.some((call) => call.op === 'update')).toBe(false);
  });

  it('rejects when the link was taken concurrently', async () => {
    configure();
    const flow = await start();
    respondWith(await idToken({ email: 'jane.doe@example.com', nonce: flow.nonce, oid: 'oid-1' }));
    fakeDb.enqueue([], [makeRow()], []);
    const error = await caught(
      callback({ code: 'c', state: flow.state, state_cookie: flow.cookie }),
    );
    expect(error.code).toBe('AUTH_MICROSOFT_REJECTED');
    expect(logCreate).not.toHaveBeenCalled();
  });
});
