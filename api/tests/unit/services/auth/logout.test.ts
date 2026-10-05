import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../support/db.js';
import { caught, installLog, OTHER_ID, storedOf } from './support.js';

const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));
const log = await installLog();

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
  log.restore();
});

afterEach(() => {
  mock.clearAllMocks();
  fakeDb.reset();
});

const { logout } = await import('@/services/auth/logout.js');

describe('auth.service.logout', () => {
  it('revokes the family of the presented token and writes an audit log', async () => {
    const row = storedOf({ user_id: OTHER_ID });
    fakeDb.enqueue([row], []);
    const result = await logout({ token: 'opaque' });
    expect(result).toEqual({ success: true, user_id: OTHER_ID });
    expect(fakeDb.calls.some((call) => call.op === 'update' && call.method === 'set')).toBe(true);
    expect(log.create).toHaveBeenCalledWith({
      actor: null,
      event: 'auth.logged_out',
      metadata: { family_id: row.family_id, user_id: OTHER_ID },
    });
  });

  it('succeeds without touching anything for an unknown token', async () => {
    fakeDb.enqueue([]);
    const result = await logout({ token: 'opaque' });
    expect(result).toEqual({ success: true, user_id: undefined });
    expect(fakeDb.calls.some((call) => call.op === 'update')).toBe(false);
    expect(log.create).not.toHaveBeenCalled();
  });

  it('succeeds without a cookie', async () => {
    expect(await logout({ token: undefined })).toEqual({ success: true, user_id: undefined });
    expect(await logout({ token: '' })).toEqual({ success: true, user_id: undefined });
    expect(fakeDb.calls).toHaveLength(0);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(logout({ token: 'opaque' }));
    expect(error.code).toBe('auth.logout.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('auth.service.logout');
  });
});
