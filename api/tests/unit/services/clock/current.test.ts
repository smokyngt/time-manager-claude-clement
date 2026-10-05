import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../support/db.js';
import { actorOf, caught, OWNER_ID, rowOf } from './support.js';

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

const { current } = await import('@/services/clock/current.js');

const actor = actorOf('employee', OWNER_ID);

describe('clock.service.current', () => {
  it('returns the open clock of the actor', async () => {
    fakeDb.enqueue([rowOf({ clocked_out_at: null })]);
    const { clock } = await current({ actor });
    expect(clock).toMatchObject({ clocked_out_at: null, duration_ms: null, user_id: OWNER_ID });
  });

  it('returns null when the actor is not clocked in', async () => {
    fakeDb.enqueue([]);
    expect(await current({ actor })).toEqual({ clock: null });
  });

  it('wraps failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(current({ actor }));
    expect(error.code).toBe('clock.current.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.service.current');
  });
});
