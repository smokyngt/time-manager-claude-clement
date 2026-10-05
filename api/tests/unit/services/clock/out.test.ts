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
import { CLOCK_ID, makeClockRow } from './fixtures.js';

const { clockOut } = await import('@/services/clock/out.js');

const actor = makeActor('employee');
const open = (age: number) =>
  makeClockRow({ clocked_in_at: Date.now() - age, clocked_out_at: null });

describe('clock.service.out', () => {
  it('closes the open clock, keeps the existing note and writes an audit log', async () => {
    fakeDb.enqueue([open(3_600_000)], [makeClockRow()]);
    const { clock } = await clockOut({ actor });
    const values = fakeDb.arg('update', 'set') as Record<string, unknown>;
    expect(typeof values['clocked_out_at']).toBe('number');
    expect(values['note']).toBeNull();
    expect(clock.duration_ms).toBe(28_800_000);
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'clock.out',
      metadata: { clock_id: CLOCK_ID, user_id: actor.id },
    });
  });

  it('replaces the note when one is given', async () => {
    fakeDb.enqueue([open(1000)], [makeClockRow({ note: 'bye' })]);
    await clockOut({ actor, note: 'bye' });
    expect((fakeDb.arg('update', 'set') as Record<string, unknown>)['note']).toBe('bye');
  });

  it('answers 409 when the user is not clocked in', async () => {
    fakeDb.enqueue([]);
    const error = await caught(clockOut({ actor }));
    expect(error.code).toBe('CLOCK_CONFLICT');
    expect(error.status).toBe(409);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('answers 409 when the clock was closed concurrently', async () => {
    fakeDb.enqueue([open(1000)], []);
    const error = await caught(clockOut({ actor }));
    expect(error.code).toBe('CLOCK_CONFLICT');
  });

  it('answers 400 when the open clock is older than 24 hours', async () => {
    fakeDb.enqueue([open(25 * 3_600_000)]);
    const error = await caught(clockOut({ actor }));
    expect(error.code).toBe('CLOCK_INVALID');
    expect(error.status).toBe(400);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(clockOut({ actor }));
    expect(error.code).toBe('CLOCK_OUT_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.service.out');
  });
});
