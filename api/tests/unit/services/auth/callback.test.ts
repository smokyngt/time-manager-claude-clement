import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { SignJWT } from 'jose';

import { Digest } from '@/utils/crypto/digest.js';

import { FakeDb } from '../../../support/db.js';
import { caught, installLog, OTHER_ID, params, rowOf, TENANT } from './support.js';

const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));
const log = await installLog();

const realFetch = globalThis.fetch;
const saved = { ...process.env };

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
  log.restore();
  process.env = saved;
  globalThis.fetch = realFetch;
});

const { authorize } = await import('@/services/auth/authorize.js');
const { callback } = await import('@/services/auth/callback.js');

afterEach(() => {
  mock.clearAllMocks();
  fakeDb.reset();
  process.env = { ...saved };
  globalThis.fetch = realFetch;
});

const configure = (): void => {
  process.env['MICROSOFT_CLIENT_ID'] = 'client-id';
  process.env['MICROSOFT_CLIENT_SECRET'] = 'client-secret';
  process.env['MICROSOFT_TENANT_ID'] = TENANT;
};

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

const respondWith = (token: string, status = 200): void => {
  globalThis.fetch = Object.assign(
    () => Promise.resolve(new Response(JSON.stringify({ id_token: token }), { status })),
    { preconnect: realFetch.preconnect },
  );
};

const run = (flow: { cookie: string; state: string }, state = flow.state) =>
  callback({ code: 'c', state, state_cookie: flow.cookie });

describe('auth.service.callback', () => {
  it('answers unavailable when Microsoft is not configured', async () => {
    const error = await caught(callback({ code: 'c', state: 's', state_cookie: 'x' }));
    expect(error.code).toBe('auth.microsoft.unavailable');
    expect(error.status).toBe(503);
  });

  it('rejects a missing, forged or mismatching state cookie', async () => {
    configure();
    const flow = await start();
    const missing = await caught(callback({ code: 'c', state: flow.state, state_cookie: undefined }));
    const mismatch = await caught(run(flow, 'other'));
    const forged = await caught(callback({ code: 'c', state: flow.state, state_cookie: 'a.b.c' }));
    for (const error of [missing, mismatch, forged]) {
      expect(error.code).toBe('auth.microsoft.rejected');
      expect(error.status).toBe(401);
    }
  });

  it('rejects a state cookie signed with another secret', async () => {
    configure();
    process.env['OAUTH_STATE_SECRET'] = 'a'.repeat(40);
    const flow = await start();
    process.env['OAUTH_STATE_SECRET'] = 'b'.repeat(40);
    const error = await caught(run(flow));
    expect(error.code).toBe('auth.microsoft.rejected');
  });

  it('rejects when the token endpoint refuses the code', async () => {
    configure();
    const flow = await start();
    respondWith('x', 400);
    expect((await caught(run(flow))).code).toBe('auth.microsoft.rejected');
  });

  it('rejects a nonce mismatch', async () => {
    configure();
    const flow = await start();
    respondWith(await idToken({ email: 'jane.doe@example.com', nonce: 'wrong', oid: 'oid-1' }));
    expect((await caught(run(flow))).code).toBe('auth.microsoft.rejected');
  });

  it('links an existing user found by email_hash and issues a session', async () => {
    configure();
    const flow = await start();
    respondWith(await idToken({ email: 'Jane.Doe@Example.com', nonce: flow.nonce, oid: 'oid-1' }));
    fakeDb.enqueue([], [rowOf()], [rowOf({ microsoft_id: `${TENANT}:oid-1` })], []);
    const session = await run(flow);
    expect(session.user.id).toBe(OTHER_ID);
    expect(session.user.email).toBe('jane.doe@example.com');
    const wheres = fakeDb.calls
      .filter((call) => call.op === 'select' && call.method === 'where')
      .map((call) => params(call.args[0]));
    expect(wheres).toEqual([[`${TENANT}:oid-1`], [Digest.email('jane.doe@example.com')]]);
    expect((fakeDb.arg('update', 'set') as Record<string, unknown>)['microsoft_id']).toBe(
      `${TENANT}:oid-1`,
    );
    expect(log.events()).toEqual(['auth.microsoft_linked', 'auth.logged_in']);
  });

  it('signs in a user already linked by tid:oid without relinking or email lookup', async () => {
    configure();
    const flow = await start();
    respondWith(await idToken({ nonce: flow.nonce, oid: 'oid-1' }));
    fakeDb.enqueue([rowOf({ microsoft_id: `${TENANT}:oid-1` })], []);
    const session = await run(flow);
    expect(session.user.id).toBe(OTHER_ID);
    expect(fakeDb.calls.some((call) => call.op === 'update')).toBe(false);
    expect(fakeDb.calls.filter((call) => call.op === 'select' && call.method === 'from')).toHaveLength(1);
  });

  it('never creates unknown users', async () => {
    configure();
    const flow = await start();
    respondWith(await idToken({ email: 'stranger@example.com', nonce: flow.nonce, oid: 'oid-2' }));
    fakeDb.enqueue([], []);
    const error = await caught(run(flow));
    expect(error.code).toBe('auth.microsoft.unknown.user');
    expect(error.status).toBe(403);
    expect(fakeDb.calls.some((call) => call.op === 'insert')).toBe(false);
  });

  it('refuses archived users', async () => {
    configure();
    const flow = await start();
    respondWith(await idToken({ nonce: flow.nonce, oid: 'oid-3' }));
    fakeDb.enqueue([rowOf({ archived_at: 1, microsoft_id: `${TENANT}:oid-3` })]);
    expect((await caught(run(flow))).code).toBe('auth.microsoft.rejected');
    expect(fakeDb.calls.some((call) => call.op === 'update')).toBe(false);
  });

  it('rejects an id token issued by another tenant before any database access', async () => {
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
    expect((await caught(run(flow))).code).toBe('auth.microsoft.rejected');
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
        await idToken({ email: 'jane.doe@example.com', nonce: flow.nonce, oid: 'oid-1', ...attempt }),
      );
      expect((await caught(run(flow))).code).toBe('auth.microsoft.rejected');
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
    const error = await caught(run(flow));
    expect(error.code).toBe('auth.microsoft.unknown.user');
    expect(fakeDb.calls.filter((call) => call.op === 'select' && call.method === 'from')).toHaveLength(1);
    expect(fakeDb.calls.some((call) => call.op === 'update')).toBe(false);
  });

  it('does not take over a user already linked to another identity', async () => {
    configure();
    const flow = await start();
    respondWith(await idToken({ email: 'jane.doe@example.com', nonce: flow.nonce, oid: 'oid-9' }));
    fakeDb.enqueue([], [rowOf({ microsoft_id: `${TENANT}:oid-1` })]);
    expect((await caught(run(flow))).code).toBe('auth.microsoft.rejected');
    expect(fakeDb.calls.some((call) => call.op === 'update')).toBe(false);
  });

  it('rejects when the link was taken concurrently', async () => {
    configure();
    const flow = await start();
    respondWith(await idToken({ email: 'jane.doe@example.com', nonce: flow.nonce, oid: 'oid-1' }));
    fakeDb.enqueue([], [rowOf()], []);
    expect((await caught(run(flow))).code).toBe('auth.microsoft.rejected');
    expect(log.create).not.toHaveBeenCalled();
  });
});
