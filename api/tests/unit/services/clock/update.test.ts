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

const { update } = await import('@/services/clock/update.js');

const actor = makeActor('manager');

describe('clock.service.update', () => {
  it('updates the note only without validation and writes an audit log with field names', async () => {
    fakeDb.enqueue([makeClockRow()], [makeClockRow({ note: 'fixed' })]);
    const { clock } = await update({ actor, data: { note: 'fixed' }, id: CLOCK_ID });
    const values = fakeDb.arg('update', 'set') as Record<string, unknown>;
    expect(values['note']).toBe('fixed');
    expect(typeof values['updated_at']).toBe('number');
    expect(clock.note).toBe('fixed');
    expect(fakeDb.calls.filter((call) => call.op === 'select')).toHaveLength(2);
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'clock.updated',
      metadata: { clock_id: CLOCK_ID, fields: ['note'], user_id: OWNER_ID },
    });
  });

  it('clears the note with null', async () => {
    fakeDb.enqueue([makeClockRow({ note: 'x' })], [makeClockRow()]);
    await update({ actor, data: { note: null }, id: CLOCK_ID });
    expect((fakeDb.arg('update', 'set') as Record<string, unknown>)['note']).toBeNull();
  });

  it('corrects the timestamps after checking overlap', async () => {
    fakeDb.enqueue([makeClockRow()], [], [makeClockRow({ clocked_out_at: 1_700_030_000_000 })]);
    const { clock } = await update({
      actor,
      data: { clocked_out_at: 1_700_030_000_000 },
      id: CLOCK_ID,
    });
    expect((fakeDb.arg('update', 'set') as Record<string, unknown>)['clocked_out_at']).toBe(
      1_700_030_000_000,
    );
    expect(clock.duration_ms).toBe(30_000_000);
  });

  it('closes an open clock when a clock-out is given', async () => {
    fakeDb.enqueue([makeClockRow({ clocked_out_at: null })], [], [makeClockRow()]);
    await update({ actor, data: { clocked_out_at: 1_700_028_800_000 }, id: CLOCK_ID });
    expect(logCreate).toHaveBeenCalledTimes(1);
  });

  it('rejects a clock-out before the clock-in', async () => {
    fakeDb.enqueue([makeClockRow()]);
    const error = await caught(
      update({ actor, data: { clocked_out_at: 1_699_999_999_000 }, id: CLOCK_ID }),
    );
    expect(error.code).toBe('CLOCK_INVALID');
    expect(error.status).toBe(400);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('rejects a clock-in in the future', async () => {
    fakeDb.enqueue([makeClockRow({ clocked_out_at: null })]);
    const error = await caught(
      update({ actor, data: { clocked_in_at: Date.now() + 3_600_000 }, id: CLOCK_ID }),
    );
    expect(error.code).toBe('CLOCK_INVALID');
  });

  it('answers 409 when the corrected clock overlaps another one', async () => {
    fakeDb.enqueue([makeClockRow()], [{ id: MISSING_ID }]);
    const error = await caught(
      update({ actor, data: { clocked_in_at: 1_699_990_000_000 }, id: CLOCK_ID }),
    );
    expect(error.code).toBe('CLOCK_OVERLAP');
    expect(error.status).toBe(409);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('throws CLOCK_NOT_FOUND when the clock does not exist', async () => {
    fakeDb.enqueue([]);
    const error = await caught(update({ actor, data: { note: 'x' }, id: MISSING_ID }));
    expect(error.code).toBe('CLOCK_NOT_FOUND');
    expect(error.status).toBe(404);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('throws CLOCK_NOT_FOUND when the row vanishes before the write', async () => {
    fakeDb.enqueue([makeClockRow()], []);
    const error = await caught(update({ actor, data: { note: 'x' }, id: CLOCK_ID }));
    expect(error.code).toBe('CLOCK_NOT_FOUND');
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(update({ actor, data: { note: 'x' }, id: CLOCK_ID }));
    expect(error.code).toBe('CLOCK_UPDATE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.service.update');
  });
});
