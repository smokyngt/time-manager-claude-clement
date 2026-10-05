import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import { caught, makeActor } from '../../../helpers/fixtures.js';

const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
});

afterEach(() => {
  fakeDb.reset();
});

const { create } = await import('@/services/log/create.js');

describe('log.service.create', () => {
  it('stores the audit entry', async () => {
    const actor = makeActor('manager');
    const result = await create({ actor, event: 'user.created', metadata: { user_id: 'x' } });
    expect(result).toEqual({ success: true });
    expect(fakeDb.arg('insert', 'values')).toEqual({
      actor_id: actor.id,
      actor_role: 'manager',
      event: 'user.created',
      metadata: { user_id: 'x' },
    });
  });

  it('accepts a missing actor and metadata', async () => {
    await create({ actor: null, event: 'auth.refresh_reuse_detected' });
    expect(fakeDb.arg('insert', 'values')).toEqual({
      actor_id: null,
      actor_role: null,
      event: 'auth.refresh_reuse_detected',
      metadata: {},
    });
  });

  it('wraps failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(create({ actor: null, event: 'x' }));
    expect(error.code).toBe('LOG_CREATE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('log.service.create');
  });
});
