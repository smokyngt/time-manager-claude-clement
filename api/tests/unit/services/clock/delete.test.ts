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

import { caught, makeActor, MISSING_ID } from '../../../helpers/fixtures.js';
import { CLOCK_ID, OWNER_ID } from './fixtures.js';

const { remove } = await import('@/services/clock/delete.js');

const actor = makeActor('admin');

describe('clock.service.delete', () => {
  it('deletes the clock and writes an audit log', async () => {
    fakeDb.enqueue([{ id: CLOCK_ID, user_id: OWNER_ID }]);
    const result = await remove({ actor, id: CLOCK_ID });
    expect(result).toEqual({ success: true });
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'clock.deleted',
      metadata: { clock_id: CLOCK_ID, user_id: OWNER_ID },
    });
  });

  it('throws CLOCK_NOT_FOUND when nothing was deleted', async () => {
    fakeDb.enqueue([]);
    const error = await caught(remove({ actor, id: MISSING_ID }));
    expect(error.code).toBe('CLOCK_NOT_FOUND');
    expect(error.status).toBe(404);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(remove({ actor, id: CLOCK_ID }));
    expect(error.code).toBe('CLOCK_DELETE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.service.delete');
  });
});
