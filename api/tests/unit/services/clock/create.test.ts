import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../support/db.js';
import { actorOf, caught, CLOCK_ID, OWNER_ID, rowOf } from './support.js';

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

const { create } = await import('@/services/clock/create.js');
const { Cipher } = await import('@/utils/crypto/cipher.js');

const actor = actorOf('manager');
const out = Date.now() - 3_600_000;
const data = { clocked_in_at: out - 8 * 3_600_000, clocked_out_at: out, note: 'Fixed', user_id: OWNER_ID };

describe('clock.service.create', () => {
  it('inserts a sealed manual clock and writes an audit log', async () => {
    fakeDb.enqueue([{ id: OWNER_ID }], [], [rowOf({ source: 'manual' })]);
    const { clock } = await create({ actor, data });
    const values = fakeDb.arg('insert', 'values') as Record<string, unknown>;
    expect(values['source']).toBe('manual');
    expect(values['user_id']).toBe(OWNER_ID);
    expect(Cipher.open(String(values['note']))).toBe('Fixed');
    expect(clock.source).toBe('manual');
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'clock.created',
      metadata: { clock_id: CLOCK_ID, user_id: OWNER_ID },
    });
  });

  it('stores a null note when none is given', async () => {
    fakeDb.enqueue([{ id: OWNER_ID }], [], [rowOf()]);
    await create({ actor, data: { ...data, note: undefined } });
    expect((fakeDb.arg('insert', 'values') as Record<string, unknown>)['note']).toBeNull();
  });

  it('throws user.not.found for an unknown owner', async () => {
    fakeDb.enqueue([]);
    const error = await caught(create({ actor, data }));
    expect(error.code).toBe('user.not.found');
    expect(error.status).toBe(404);
  });

  it('throws clock.overlap when another clock overlaps', async () => {
    fakeDb.enqueue([{ id: OWNER_ID }], [{ id: CLOCK_ID }]);
    const error = await caught(create({ actor, data }));
    expect(error.code).toBe('clock.overlap');
    expect(error.status).toBe(409);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it.each([
    ['order', { ...data, clocked_out_at: data.clocked_in_at }],
    ['future', { ...data, clocked_out_at: Date.now() + 60_000 }],
    ['duration', { ...data, clocked_in_at: data.clocked_out_at - 25 * 3_600_000 }],
  ])('throws clock.invalid on %s', async (reason, input) => {
    const error = await caught(create({ actor, data: input }));
    expect(error.code).toBe('clock.invalid');
    expect(error.status).toBe(400);
    expect(error.metadata['reason']).toBe(reason);
  });

  it('throws clock.invalid for a clock-in in the future', async () => {
    const error = await caught(
      create({ actor, data: { ...data, clocked_in_at: Date.now() + 60_000 } }),
    );
    expect(error.code).toBe('clock.invalid');
    expect(error.metadata['field']).toBe('clocked_in_at');
  });

  it('wraps failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(create({ actor, data }));
    expect(error.code).toBe('clock.create.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.service.create');
  });

  it('fails when the insert returns no row', async () => {
    fakeDb.enqueue([{ id: OWNER_ID }], [], []);
    const error = await caught(create({ actor, data }));
    expect(error.code).toBe('clock.create.failed');
  });
});
