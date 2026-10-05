import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../support/db.js';
import { caught, CLOCK_ID, MISSING_ID, OWNER_ID, rowOf, sealed } from './support.js';

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

const { retrieve } = await import('@/services/clock/retrieve.js');

describe('clock.service.retrieve', () => {
  it('returns the decrypted public entity', async () => {
    fakeDb.enqueue([rowOf({ note: sealed('Client site') })]);
    const { clock } = await retrieve({ id: CLOCK_ID });
    expect(clock).toMatchObject({ id: CLOCK_ID, note: 'Client site', object: 'clock' });
    expect(clock.user_id).toBe(OWNER_ID);
  });

  it('throws clock.not.found for an unknown id', async () => {
    fakeDb.enqueue([]);
    const error = await caught(retrieve({ id: MISSING_ID }));
    expect(error.code).toBe('clock.not.found');
    expect(error.status).toBe(404);
    expect(error.metadata['clock_id']).toBe(MISSING_ID);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(retrieve({ id: CLOCK_ID }));
    expect(error.code).toBe('clock.retrieve.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.service.retrieve');
  });

});
