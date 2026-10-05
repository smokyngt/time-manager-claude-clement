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

import { caught, MISSING_ID } from '../../../helpers/fixtures.js';
import { CLOCK_ID, makeClockRow } from './fixtures.js';

const { retrieve } = await import('@/services/clock/retrieve.js');

describe('clock.service.retrieve', () => {
  it('returns the entity with a computed duration', async () => {
    fakeDb.enqueue([makeClockRow()]);
    const { clock } = await retrieve({ id: CLOCK_ID });
    expect(clock.id).toBe(CLOCK_ID);
    expect(clock.object).toBe('clock');
    expect(clock.duration_ms).toBe(28_800_000);
  });

  it('throws CLOCK_NOT_FOUND when the clock does not exist', async () => {
    fakeDb.enqueue([]);
    const error = await caught(retrieve({ id: MISSING_ID }));
    expect(error.code).toBe('CLOCK_NOT_FOUND');
    expect(error.status).toBe(404);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(retrieve({ id: CLOCK_ID }));
    expect(error.code).toBe('CLOCK_RETRIEVE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.service.retrieve');
  });
});
