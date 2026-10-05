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

const { archive } = await import('@/services/user/archive.js');

const actor = actorOf('admin');

describe('user.service.archive', () => {
  it('archives the user and writes an audit log', async () => {
    fakeDb.enqueue([rowOf()], []);
    const { user } = await archive({ actor, id: OTHER_ID });
    const values = fakeDb.arg('update', 'set') as Record<string, unknown>;
    expect(typeof values['archived_at']).toBe('number');
    expect(typeof values['updated_at']).toBe('number');
    expect(user.id).toBe(OTHER_ID);
    expect(user.first_name).toBe('Jane');
    expect(user).not.toHaveProperty('password_hash');
    expect(user).not.toHaveProperty('email_hash');
    expect(fakeDb.calls.filter((call) => call.op === 'update' && call.method === 'set')).toHaveLength(2);
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'user.archived',
      metadata: { user_id: OTHER_ID },
    });
  });

  it('throws user.not.found when nothing matches', async () => {
    fakeDb.enqueue([]);
    const error = await caught(archive({ actor, id: MISSING_ID }));
    expect(error.code).toBe('user.not.found');
    expect(error.status).toBe(404);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(archive({ actor, id: OTHER_ID }));
    expect(error.code).toBe('user.archive.failed');
    expect(error.status).toBe(500);
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('user.service.archive');
  });
});
