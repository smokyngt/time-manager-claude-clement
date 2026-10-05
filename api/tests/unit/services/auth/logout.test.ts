import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import { caught, EMPLOYEE_ID, makeActor, OTHER_ID } from '../../../helpers/fixtures.js';

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

const { logout } = await import('@/services/auth/logout.js');

const actor = makeActor('employee', OTHER_ID);

describe('auth.service.logout', () => {
  it('revokes the family of the presented token and writes an audit log', async () => {
    fakeDb.enqueue([{ family_id: 'family-1', user_id: OTHER_ID }], []);
    const result = await logout({ actor, token: 'opaque' });
    expect(result).toEqual({ success: true });
    expect(fakeDb.calls.some((call) => call.op === 'update' && call.method === 'set')).toBe(true);
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'auth.logged_out',
      metadata: { user_id: OTHER_ID },
    });
  });

  it('does not revoke a family owned by another user', async () => {
    fakeDb.enqueue([{ family_id: 'family-1', user_id: EMPLOYEE_ID }]);
    await logout({ actor, token: 'opaque' });
    expect(fakeDb.calls.some((call) => call.op === 'update')).toBe(false);
  });

  it('succeeds without a cookie', async () => {
    const result = await logout({ actor, token: undefined });
    expect(result).toEqual({ success: true });
    expect(fakeDb.calls).toHaveLength(0);
    expect(logCreate).toHaveBeenCalledTimes(1);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(logout({ actor, token: 'opaque' }));
    expect(error.code).toBe('AUTH_LOGOUT_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('auth.service.logout');
  });
});
