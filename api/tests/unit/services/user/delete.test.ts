import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../support/db.js';

import { actorOf, caught, MISSING_ID, OTHER_ID, rowOf } from './support.js';

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

const { remove } = await import('@/services/user/delete.js');

const actor = actorOf('admin');

describe('user.service.delete', () => {
  it('revokes sessions, deletes the user and writes an audit log', async () => {
    fakeDb.enqueue([], [{ id: OTHER_ID }]);
    const result = await remove({ actor, id: OTHER_ID });
    expect(result).toEqual({ success: true });
    expect(fakeDb.calls.filter((call) => call.op === 'update' && call.method === 'set')).toHaveLength(1);
    expect(fakeDb.calls.some((call) => call.op === 'delete' && call.method === 'where')).toBe(true);
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'user.deleted',
      metadata: { user_id: OTHER_ID },
    });
  });

  it('throws user.not.found when nothing is deleted', async () => {
    fakeDb.enqueue([], []);
    const error = await caught(remove({ actor, id: MISSING_ID }));
    expect(error.code).toBe('user.not.found');
    expect(error.status).toBe(404);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(remove({ actor, id: OTHER_ID }));
    expect(error.code).toBe('user.delete.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('user.service.delete');
  });
});
