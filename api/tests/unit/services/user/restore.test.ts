import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import { caught, makeActor, makeRow, MISSING_ID, OTHER_ID } from '../../../helpers/fixtures.js';

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

const { restore } = await import('@/services/user/restore.js');

const actor = makeActor('admin');

describe('user.service.restore', () => {
  it('clears archived_at and writes an audit log', async () => {
    fakeDb.enqueue([makeRow()]);
    const { user } = await restore({ actor, id: OTHER_ID });
    expect((fakeDb.arg('update', 'set') as Record<string, unknown>)['archived_at']).toBeNull();
    expect(user.archived_at).toBeNull();
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'user.restored',
      metadata: { user_id: OTHER_ID },
    });
  });

  it('throws USER_NOT_FOUND when the user does not exist', async () => {
    fakeDb.enqueue([]);
    const error = await caught(restore({ actor, id: MISSING_ID }));
    expect(error.code).toBe('USER_NOT_FOUND');
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(restore({ actor, id: OTHER_ID }));
    expect(error.code).toBe('USER_RESTORE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('user.service.restore');
  });
});
