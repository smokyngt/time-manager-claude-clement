import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import { caught, makeRow, MISSING_ID, OTHER_ID } from '../../../helpers/fixtures.js';

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

const { retrieve } = await import('@/services/user/retrieve.js');

describe('user.service.retrieve', () => {
  it('returns the public entity without secrets', async () => {
    fakeDb.enqueue([makeRow({ microsoft_id: 'oid' })]);
    const { user } = await retrieve({ id: OTHER_ID });
    expect(user.id).toBe(OTHER_ID);
    expect(user.object).toBe('user');
    expect(Object.keys(user)).not.toContain('password_hash');
    expect(Object.keys(user)).not.toContain('microsoft_id');
  });

  it('throws USER_NOT_FOUND when the user does not exist', async () => {
    fakeDb.enqueue([]);
    const error = await caught(retrieve({ id: MISSING_ID }));
    expect(error.code).toBe('USER_NOT_FOUND');
    expect(error.status).toBe(404);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(retrieve({ id: OTHER_ID }));
    expect(error.code).toBe('USER_RETRIEVE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('user.service.retrieve');
  });
});
