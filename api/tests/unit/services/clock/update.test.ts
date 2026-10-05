import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../support/db.js';
import { actorOf, caught, CLOCK_ID, MISSING_ID, OWNER_ID, rowOf, sealed } from './support.js';

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

const { update } = await import('@/services/clock/update.js');
const { Cipher } = await import('@/utils/crypto/cipher.js');

const actor = actorOf('manager');
const closed = Date.now() - 3_600_000;
const existing = rowOf({ clocked_in_at: closed - 8 * 3_600_000, clocked_out_at: closed });

describe('clock.service.update', () => {
  it('validates, checks overlap, seals the note and writes an audit log', async () => {
    fakeDb.enqueue([existing], [], [{ ...existing, updated_at: 1 }]);
    const { clock } = await update({
      actor,
      data: { clocked_out_at: closed - 60_000, note: 'Corrected' },
      id: CLOCK_ID,
    });
    const values = fakeDb.arg('update', 'set') as Record<string, unknown>;
    expect(values['clocked_out_at']).toBe(closed - 60_000);
    expect(Cipher.open(String(values['note']))).toBe('Corrected');
    expect(typeof values['updated_at']).toBe('number');
    expect(clock.id).toBe(CLOCK_ID);
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'clock.updated',
      metadata: { clock_id: CLOCK_ID, fields: ['clocked_out_at', 'note'], user_id: OWNER_ID },
    });
  });

  it('clears the note with null and skips the overlap check', async () => {
    fakeDb.enqueue([existing], [existing]);
    await update({ actor, data: { note: null }, id: CLOCK_ID });
    expect((fakeDb.arg('update', 'set') as Record<string, unknown>)['note']).toBeNull();
    expect(fakeDb.calls.filter((call) => call.method === 'from')).toHaveLength(1);
  });

  it('does not touch the note when it is not part of the data', async () => {
    fakeDb.enqueue([{ ...existing, note: sealed('x') }], [], [existing]);
    await update({ actor, data: { clocked_out_at: closed - 1000 }, id: CLOCK_ID });
    expect(fakeDb.arg('update', 'set')).not.toHaveProperty('note');
  });

  it('throws clock.not.found for an unknown clock', async () => {
    fakeDb.enqueue([]);
    const error = await caught(update({ actor, data: { note: null }, id: MISSING_ID }));
    expect(error.code).toBe('clock.not.found');
    expect(error.status).toBe(404);
  });

  it('throws clock.overlap when the corrected clock overlaps another one', async () => {
    fakeDb.enqueue([existing], [{ id: '00000000-0000-4000-8000-0000000000f2' }]);
    const error = await caught(update({ actor, data: { clocked_out_at: closed - 1 }, id: CLOCK_ID }));
    expect(error.code).toBe('clock.overlap');
    expect(error.status).toBe(409);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('throws clock.invalid when the clock-out is not after the clock-in', async () => {
    fakeDb.enqueue([existing]);
    const error = await caught(
      update({ actor, data: { clocked_out_at: existing.clocked_in_at }, id: CLOCK_ID }),
    );
    expect(error.code).toBe('clock.invalid');
    expect(error.status).toBe(400);
  });

  it('throws clock.invalid when closing a clock in the future', async () => {
    fakeDb.enqueue([rowOf({ clocked_in_at: closed, clocked_out_at: null })]);
    const error = await caught(
      update({ actor, data: { clocked_out_at: Date.now() + 60_000 }, id: CLOCK_ID }),
    );
    expect(error.code).toBe('clock.invalid');
  });

  it('throws clock.not.found when the update affects no row', async () => {
    fakeDb.enqueue([existing], []);
    const error = await caught(update({ actor, data: { note: null }, id: CLOCK_ID }));
    expect(error.code).toBe('clock.not.found');
  });

  it('wraps failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(update({ actor, data: { note: null }, id: CLOCK_ID }));
    expect(error.code).toBe('clock.update.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.service.update');
  });
});
