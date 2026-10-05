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
import { CLOCK_ID, makeClockRow, OWNER_ID } from './fixtures.js';

const { clockIn } = await import('@/services/clock/in.js');

const actor = makeActor('employee');

describe('clock.service.in', () => {
  it('opens a clock for the actor and writes an audit log', async () => {
    fakeDb.enqueue([makeClockRow({ clocked_out_at: null })]);
    const before = Date.now();
    const { clock } = await clockIn({ actor, note: 'hello' });
    const values = fakeDb.arg('insert', 'values') as Record<string, unknown>;
    expect(values['user_id']).toBe(actor.id);
    expect(values['source']).toBe('clock');
    expect(values['note']).toBe('hello');
    expect(values['clocked_in_at'] as number).toBeGreaterThanOrEqual(before);
    expect(clock.object).toBe('clock');
    expect(clock.duration_ms).toBeNull();
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'clock.in',
      metadata: { clock_id: CLOCK_ID, user_id: actor.id },
    });
  });

  it('stores a null note when none is given', async () => {
    fakeDb.enqueue([makeClockRow({ clocked_out_at: null, user_id: OWNER_ID })]);
    await clockIn({ actor });
    expect((fakeDb.arg('insert', 'values') as Record<string, unknown>)['note']).toBeNull();
  });

  it('maps a unique violation to a 409 conflict', async () => {
    fakeDb.enqueue(Object.assign(new Error('duplicate'), { code: '23505' }));
    const error = await caught(clockIn({ actor }));
    expect(error.code).toBe('CLOCK_CONFLICT');
    expect(error.status).toBe(409);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(clockIn({ actor }));
    expect(error.code).toBe('CLOCK_IN_ERROR');
    expect(error.status).toBe(500);
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.service.in');
  });

  it('fails when the insert returns no row', async () => {
    fakeDb.enqueue([]);
    const error = await caught(clockIn({ actor }));
    expect(error.code).toBe('CLOCK_IN_ERROR');
  });
});
