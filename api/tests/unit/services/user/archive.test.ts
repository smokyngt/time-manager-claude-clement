import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import {
  ADMIN_ID,
  caught,
  makeActor,
  makeRow,
  MISSING_ID,
  OTHER_ID,
} from '../../../helpers/fixtures.js';

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

const { archive } = await import('@/services/user/archive.js');

const actor = makeActor('admin');

describe('user.service.archive', () => {
  it('sets archived_at, revokes refresh tokens and writes an audit log', async () => {
    fakeDb.enqueue([makeRow({ archived_at: 1_700_000_100_000 })], []);
    const { user } = await archive({ actor, id: OTHER_ID });
    const set = fakeDb.calls.filter((call) => call.op === 'update' && call.method === 'set');
    expect(set).toHaveLength(2);
    expect(typeof (set[0]?.args[0] as Record<string, unknown>)['archived_at']).toBe('number');
    expect(typeof (set[1]?.args[0] as Record<string, unknown>)['revoked_at']).toBe('number');
    expect(user.archived_at).toBe(1_700_000_100_000);
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'user.archived',
      metadata: { user_id: OTHER_ID },
    });
  });

  it('throws USER_NOT_FOUND when the user does not exist', async () => {
    fakeDb.enqueue([]);
    const error = await caught(archive({ actor, id: MISSING_ID }));
    expect(error.code).toBe('USER_NOT_FOUND');
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(archive({ actor, id: ADMIN_ID }));
    expect(error.code).toBe('USER_ARCHIVE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('user.service.archive');
  });
});
