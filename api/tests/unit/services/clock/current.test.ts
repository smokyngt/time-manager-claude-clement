import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';

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

import { caught, makeActor } from '../../../helpers/fixtures.js';
import { makeClockRow } from './fixtures.js';

const { current } = await import('@/services/clock/current.js');

const actor = makeActor('employee');

describe('clock.service.current', () => {
  it('returns the open clock', async () => {
    fakeDb.enqueue([makeClockRow({ clocked_out_at: null })]);
    const { clock } = await current({ actor });
    expect(clock?.object).toBe('clock');
    expect(clock?.clocked_out_at).toBeNull();
    expect(clock?.duration_ms).toBeNull();
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('returns null when the user is not clocked in', async () => {
    fakeDb.enqueue([]);
    const { clock } = await current({ actor });
    expect(clock).toBeNull();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(current({ actor }));
    expect(error.code).toBe('CLOCK_CURRENT_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.service.current');
  });
});
