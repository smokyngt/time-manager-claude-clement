import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../helpers/fake-db.js';
import { caught, makeReq, OTHER_ID } from '../../helpers/fixtures.js';

import type { FastifyReply, FastifyRequest } from 'fastify';

const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
});

afterEach(() => {
  fakeDb.reset();
});

const { auth } = await import('@/plugins/auth.js');
const { Tokens } = await import('@/lib/auth/tokens.js');

const request = async (role: 'admin' | 'employee' | 'manager'): Promise<FastifyRequest> => {
  const { token } = await Tokens.access({ id: OTHER_ID, role });
  const req = makeReq<FastifyRequest>();
  req.headers.authorization = `Bearer ${token}`;
  return req;
};

const reply = {} as FastifyReply;

describe('plugins.auth', () => {
  it('rejects a missing bearer token', async () => {
    const error = await caught(auth({ scopes: ['auth:self'] })(makeReq<FastifyRequest>(), reply));
    expect(error.status).toBe(401);
    expect(fakeDb.calls).toHaveLength(0);
  });

  it('rejects a valid token whose user no longer exists', async () => {
    fakeDb.enqueue([]);
    const error = await caught(auth({ scopes: ['auth:self'] })(await request('admin'), reply));
    expect(error.status).toBe(401);
  });

  it('rejects a valid token whose user is archived', async () => {
    fakeDb.enqueue([{ archived_at: 5, id: OTHER_ID, role: 'admin' }]);
    const error = await caught(auth({ scopes: ['auth:self'] })(await request('admin'), reply));
    expect(error.status).toBe(401);
  });

  it('uses the database role, not the stale token role', async () => {
    fakeDb.enqueue([{ archived_at: null, id: OTHER_ID, role: 'employee' }]);
    const req = await request('admin');
    await auth({ scopes: ['auth:self'] })(req, reply);
    expect(req.actor).toEqual({ id: OTHER_ID, role: 'employee', team_ids: [] });
  });

  it('refuses scopes the database role lacks even if the token claims more', async () => {
    fakeDb.enqueue([{ archived_at: null, id: OTHER_ID, role: 'employee' }]);
    const error = await caught(auth({ scopes: ['users:manage'] })(await request('admin'), reply));
    expect(error.status).toBe(403);
  });

  it('selects only the identity columns with a single primary key lookup', async () => {
    fakeDb.enqueue([{ archived_at: null, id: OTHER_ID, role: 'manager' }]);
    await auth({ scopes: ['auth:self'] })(await request('manager'), reply);
    expect(fakeDb.calls.filter((call) => call.op === 'select' && call.method === 'from')).toHaveLength(1);
    expect(fakeDb.calls.find((call) => call.method === 'limit')?.args).toEqual([1]);
  });
});
