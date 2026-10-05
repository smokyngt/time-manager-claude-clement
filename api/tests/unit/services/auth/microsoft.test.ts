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

const saved = { ...process.env };
const realFetch = globalThis.fetch;

const configure = (): void => {
  process.env['MICROSOFT_CLIENT_ID'] = 'client-id';
  process.env['MICROSOFT_CLIENT_SECRET'] = 'client-secret';
};

afterAll(() => {
  process.env = saved;
  globalThis.fetch = realFetch;
});

afterEach(() => {
  delete process.env['MICROSOFT_CLIENT_ID'];
  delete process.env['MICROSOFT_CLIENT_SECRET'];
  globalThis.fetch = realFetch;
});

const idToken = async (claims: Record<string, unknown>): Promise<string> =>
  new SignJWT({ iss: 'https://login.microsoftonline.com/tenant/v2.0', ...claims })
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

  it('builds an authorization code + PKCE url and a signed state cookie', async () => {
    configure();
    const result = await authorize();
    const url = new URL(result.url);
    expect(url.origin + url.pathname).toBe(
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
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
    fakeDb.enqueue([], [makeRow()], [makeRow({ microsoft_id: 'oid-1' })], []);
    const session = await callback({ code: 'c', state: flow.state, state_cookie: flow.cookie });
    expect(session.user.id).toBe(OTHER_ID);
    expect((fakeDb.arg('update', 'set') as Record<string, unknown>)['microsoft_id']).toBe('oid-1');
    const events = (logCreate.mock.calls as unknown as [{ event: string }][]).map(
      ([entry]) => entry.event,
    );
    expect(events).toEqual(['auth.microsoft_linked', 'auth.logged_in']);
  });

  it('signs in a user already linked by oid without relinking', async () => {
    configure();
    const flow = await start();
    respondWith(await idToken({ nonce: flow.nonce, oid: 'oid-1' }));
    fakeDb.enqueue([makeRow({ microsoft_id: 'oid-1' })], []);
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
    fakeDb.enqueue([makeRow({ archived_at: 1, microsoft_id: 'oid-3' })]);
    const archived = await caught(
      callback({ code: 'c', state: flow.state, state_cookie: flow.cookie }),
    );
    expect(other.code).toBe('AUTH_MICROSOFT_REJECTED');
    expect(archived.code).toBe('AUTH_MICROSOFT_REJECTED');
  });
});
