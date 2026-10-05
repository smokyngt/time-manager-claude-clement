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

const { clockIn } = await import('@/services/clock/in.js');
const { Cipher } = await import('@/utils/crypto/cipher.js');

const actor = actorOf('employee', OWNER_ID);

describe('clock.service.in', () => {
  it('opens a sealed clock for the actor and writes an audit log', async () => {
    fakeDb.enqueue([rowOf({ clocked_out_at: null })]);
    const before = Date.now();
    const { clock } = await clockIn({ actor, note: 'hello' });
    const values = fakeDb.arg('insert', 'values') as Record<string, unknown>;
    expect(values['user_id']).toBe(actor.id);
    expect(values['source']).toBe('clock');
    expect(values['note']).not.toBe('hello');
    expect(Cipher.open(String(values['note']))).toBe('hello');
    expect(values['clocked_in_at'] as number).toBeGreaterThanOrEqual(before);
    expect(clock.object).toBe('clock');
    expect(clock.duration_ms).toBeNull();
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'clock.started',
      metadata: { clock_id: CLOCK_ID, user_id: actor.id },
    });
  });

  it('stores a null note when none is given', async () => {
    fakeDb.enqueue([rowOf({ clocked_out_at: null })]);
    await clockIn({ actor });
    expect((fakeDb.arg('insert', 'values') as Record<string, unknown>)['note']).toBeNull();
  });

  it('maps a violation of the open clock index to clock.conflict without the pg cause', async () => {
    fakeDb.enqueue(
      Object.assign(new Error('duplicate'), {
        code: '23505',
        constraint_name: 'clocks_user_id_open_idx',
      }),
    );
    const error = await caught(clockIn({ actor }));
    expect(error.code).toBe('clock.conflict');
    expect(error.status).toBe(409);
    expect(error.cause).toBeUndefined();
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('finds the index violation inside a wrapped driver error', async () => {
    const inner = Object.assign(new Error('duplicate'), {
      code: '23505',
      constraint_name: 'clocks_user_id_open_idx',
    });
    fakeDb.enqueue(new Error('query failed', { cause: inner }));
    const error = await caught(clockIn({ actor }));
    expect(error.code).toBe('clock.conflict');
  });

  it('maps another unique violation to duplicate.key', async () => {
    fakeDb.enqueue(Object.assign(new Error('duplicate'), { code: '23505', constraint_name: 'x' }));
    const error = await caught(clockIn({ actor }));
    expect(error.code).toBe('duplicate.key');
    expect(error.status).toBe(409);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(clockIn({ actor }));
    expect(error.code).toBe('clock.in.failed');
    expect(error.status).toBe(500);
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('clock.service.in');
  });

  it('fails when the insert returns no row', async () => {
    fakeDb.enqueue([]);
    const error = await caught(clockIn({ actor }));
    expect(error.code).toBe('clock.in.failed');
  });
});
