import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../support/db.js';

import { actorOf, caught, CLOCK_ID, OWNER_ID, rowOf, sealed } from './support.js';

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

const { clockOut } = await import('@/services/clock/out.js');
const { Cipher } = await import('@/utils/crypto/cipher.js');

const actor = actorOf('employee', OWNER_ID);

const openRow = (overrides = {}) =>
  rowOf({ clocked_in_at: Date.now() - 3_600_000, clocked_out_at: null, ...overrides });

describe('clock.service.out', () => {
  it('closes the open clock, seals the note and writes an audit log', async () => {
    const open = openRow();
    fakeDb.enqueue([open], [{ ...open, clocked_out_at: Date.now() }]);
    const { clock } = await clockOut({ actor, note: 'done' });
    const values = fakeDb.arg('update', 'set') as Record<string, unknown>;
    expect(typeof values['clocked_out_at']).toBe('number');
    expect(typeof values['updated_at']).toBe('number');
    expect(Cipher.open(String(values['note']))).toBe('done');
    expect(clock.object).toBe('clock');
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'clock.stopped',
      metadata: { clock_id: CLOCK_ID, user_id: actor.id },
    });
  });

  it('keeps the sealed note of the open clock when none is given', async () => {
    const note = sealed('first');
    fakeDb.enqueue([openRow({ note })], [openRow({ clocked_out_at: Date.now(), note })]);
    await clockOut({ actor });
    expect((fakeDb.arg('update', 'set') as Record<string, unknown>)['note']).toBe(note);
  });

  it('answers clock.conflict when the user is not clocked in', async () => {
    fakeDb.enqueue([]);
    const error = await caught(clockOut({ actor }));
    expect(error.code).toBe('clock.conflict');
    expect(error.status).toBe(409);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('answers clock.conflict when the clock was closed concurrently', async () => {
    fakeDb.enqueue([openRow()], []);
    const error = await caught(clockOut({ actor }));
    expect(error.code).toBe('clock.conflict');
  });

  it('answers clock.invalid when the open clock is older than 24 hours', async () => {
    fakeDb.enqueue([openRow({ clocked_in_at: Date.now() - 25 * 3_600_000 })]);
    const error = await caught(clockOut({ actor }));
    expect(error.code).toBe('clock.invalid');
    expect(error.status).toBe(400);
    expect(error.metadata['reason']).toBe('duration');
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(clockOut({ actor }));
    expect(error.code).toBe('clock.out.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.service.out');
  });
});
