import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import { caught, makeActor, makeRow, OTHER_ID } from '../../../helpers/fixtures.js';

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

const { me } = await import('@/services/auth/me.js');

const actor = makeActor('employee', OTHER_ID);

describe('auth.service.me', () => {
  it('returns the current user', async () => {
    fakeDb.enqueue([makeRow()]);
    const { user } = await me({ actor });
    expect(user.id).toBe(OTHER_ID);
    expect(user).not.toHaveProperty('password_hash');
  });

  it('treats a deleted user as an invalid session', async () => {
    fakeDb.enqueue([]);
    const error = await caught(me({ actor }));
    expect(error.code).toBe('AUTH_SESSION_INVALID');
    expect(error.status).toBe(401);
  });

  it('treats an archived user as an invalid session', async () => {
    fakeDb.enqueue([makeRow({ archived_at: 1 })]);
    const error = await caught(me({ actor }));
    expect(error.code).toBe('AUTH_SESSION_INVALID');
  });

  it('wraps unexpected failures', async () => {
    fakeDb.enqueue(new Error('db down'));
    const error = await caught(me({ actor }));
    expect(error.code).toBe('AUTH_SESSION_INVALID');
    expect(error.metadata['route']).toBe('auth.service.me');
  });
});
