import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import { caught, makeActor, MISSING_ID, OTHER_ID } from '../../../helpers/fixtures.js';

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

const actor = makeActor('admin');

describe('user.service.delete', () => {
  it('deletes the user and writes an audit log', async () => {
    fakeDb.enqueue([], [{ id: OTHER_ID }]);
    const result = await remove({ actor, id: OTHER_ID });
    expect(result).toEqual({ success: true });
    const set = fakeDb.arg('update', 'set') as Record<string, unknown>;
    expect(typeof set['revoked_at']).toBe('number');
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'user.deleted',
      metadata: { user_id: OTHER_ID },
    });
  });

  it('throws USER_NOT_FOUND when nothing was deleted', async () => {
    fakeDb.enqueue([], []);
    const error = await caught(remove({ actor, id: MISSING_ID }));
    expect(error.code).toBe('USER_NOT_FOUND');
    expect(error.status).toBe(404);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(remove({ actor, id: OTHER_ID }));
    expect(error.code).toBe('USER_DELETE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('user.service.delete');
  });
});
