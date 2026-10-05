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
import { CLOCK_ID, makeClockRow, OWNER_ID } from './fixtures.js';

const { create } = await import('@/services/clock/create.js');

const actor = makeActor('manager');
const data = {
  clocked_in_at: 1_700_000_000_000,
  clocked_out_at: 1_700_028_800_000,
  note: 'forgot to clock',
  user_id: OWNER_ID,
};

describe('clock.service.create', () => {
  it('creates a manual clock and writes an audit log', async () => {
    fakeDb.enqueue([{ id: OWNER_ID }], [], [makeClockRow({ source: 'manual' })]);
    const { clock } = await create({ actor, data });
    const values = fakeDb.arg('insert', 'values') as Record<string, unknown>;
    expect(values['source']).toBe('manual');
    expect(values['user_id']).toBe(OWNER_ID);
    expect(values['note']).toBe('forgot to clock');
    expect(clock.source).toBe('manual');
    expect(clock.duration_ms).toBe(28_800_000);
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'clock.created',
      metadata: { clock_id: CLOCK_ID, user_id: OWNER_ID },
    });
  });

  it('rejects a clock-out that is not after the clock-in', async () => {
    const error = await caught(
      create({ actor, data: { ...data, clocked_out_at: data.clocked_in_at } }),
    );
    expect(error.code).toBe('CLOCK_INVALID');
    expect(error.status).toBe(400);
    expect(fakeDb.calls).toHaveLength(0);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('rejects timestamps in the future', async () => {
    const future = Date.now() + 3_600_000;
    const error = await caught(
      create({ actor, data: { ...data, clocked_in_at: future - 1000, clocked_out_at: future } }),
    );
    expect(error.code).toBe('CLOCK_INVALID');
  });

  it('rejects a clock longer than 24 hours', async () => {
    const error = await caught(
      create({ actor, data: { ...data, clocked_out_at: data.clocked_in_at + 24 * 3_600_000 + 1 } }),
    );
    expect(error.code).toBe('CLOCK_INVALID');
  });

  it('accepts a clock of exactly 24 hours', async () => {
    fakeDb.enqueue([{ id: OWNER_ID }], [], [makeClockRow()]);
    await create({ actor, data: { ...data, clocked_out_at: data.clocked_in_at + 24 * 3_600_000 } });
    expect(logCreate).toHaveBeenCalledTimes(1);
  });

  it('throws USER_NOT_FOUND when the user does not exist', async () => {
    fakeDb.enqueue([]);
    const error = await caught(create({ actor, data: { ...data, user_id: MISSING_ID } }));
    expect(error.code).toBe('USER_NOT_FOUND');
    expect(error.status).toBe(404);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('answers 409 when the clock overlaps another one', async () => {
    fakeDb.enqueue([{ id: OWNER_ID }], [{ id: CLOCK_ID }]);
    const error = await caught(create({ actor, data }));
    expect(error.code).toBe('CLOCK_OVERLAP');
    expect(error.status).toBe(409);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(create({ actor, data }));
    expect(error.code).toBe('CLOCK_CREATE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.service.create');
  });

  it('fails when the insert returns no row', async () => {
    fakeDb.enqueue([{ id: OWNER_ID }], [], []);
    const error = await caught(create({ actor, data }));
    expect(error.code).toBe('CLOCK_CREATE_ERROR');
  });
});
