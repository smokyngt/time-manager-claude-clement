import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../support/db.js';
import { Fake } from '../../../support/fake.js';
import { caught, EMPLOYEE_ID } from '../../services/user/support.js';

const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
});

afterEach(() => {
  fakeDb.reset();
});

const { Tokens } = await import('@/lib/auth/tokens.js');
const { Identity } = await import('@/middlewares/auth/identity.js');
const { auth } = await import('@/middlewares/auth/index.js');
const { Access } = await import('@/utils/auth/authz.js');

const request = async (role: 'admin' | 'employee' | 'manager') => {
  const { token } = await Tokens.access({ id: EMPLOYEE_ID, role });

  return Fake.request({ headers: { authorization: `Bearer ${token}` } });
};

describe('middlewares.identity.load', () => {
  it('returns the actor with the role stored in the database', async () => {
    fakeDb.enqueue([{ archived_at: null, id: EMPLOYEE_ID, role: 'manager' }]);
    expect(await Identity.load(EMPLOYEE_ID)).toEqual({
      id: EMPLOYEE_ID,
      role: 'manager',
      team_ids: [],
    });
  });

  it('rejects an archived or deleted user with token.authentication.failed', async () => {
    fakeDb.enqueue([{ archived_at: 5, id: EMPLOYEE_ID, role: 'employee' }]);
    const archived = await caught(Identity.load(EMPLOYEE_ID));
    fakeDb.enqueue([]);
    const missing = await caught(Identity.load(EMPLOYEE_ID));
    for (const error of [archived, missing]) {
      expect(error.code).toBe('token.authentication.failed');
      expect(error.status).toBe(401);
    }
  });
});

describe('middlewares.auth with stale access tokens', () => {
  it('trusts the database role over the role claim: a demoted admin loses admin scopes', async () => {
    fakeDb.enqueue([{ archived_at: null, id: EMPLOYEE_ID, role: 'employee' }]);
    const error = await caught(
      auth({ scopes: ['users:manage'] })(await request('admin'), Fake.reply()),
    );
    expect(error.code).toBe('unauthorized');
    expect(error.status).toBe(403);
  });

  it('grants the scopes of the current database role to a promoted user', async () => {
    fakeDb.enqueue([{ archived_at: null, id: EMPLOYEE_ID, role: 'manager' }]);
    const req = await request('employee');
    await auth({ scopes: ['teams:manage'] })(req, Fake.reply());
    const { actor, scopes } = Access.context(req);
    expect(actor.role).toBe('manager');
    expect(scopes).toContain('teams:manage');
  });

  it('rejects a still valid token once the user is archived', async () => {
    fakeDb.enqueue([{ archived_at: 5, id: EMPLOYEE_ID, role: 'employee' }]);
    const error = await caught(auth({ scopes: [] })(await request('employee'), Fake.reply()));
    expect(error.code).toBe('token.authentication.failed');
    expect(error.status).toBe(401);
  });

  it('rejects a still valid token once the user is deleted', async () => {
    fakeDb.enqueue([]);
    const error = await caught(auth({ scopes: [] })(await request('employee'), Fake.reply()));
    expect(error.status).toBe(401);
  });
});
