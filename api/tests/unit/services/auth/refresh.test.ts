import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../support/db.js';
import { caught, installLog, OTHER_ID, rowOf, storedOf } from './support.js';

const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));
const log = await installLog();

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
  log.restore();
});

afterEach(() => {
  mock.clearAllMocks();
  fakeDb.reset();
});

const { Tokens } = await import('@/lib/auth/tokens.js');
const { refresh } = await import('@/services/auth/refresh.js');

const revoked = (): boolean =>
  fakeDb.calls.some((call) => call.op === 'update' && call.method === 'set');
const inserted = (): boolean => fakeDb.calls.some((call) => call.op === 'insert');

describe('auth.service.refresh', () => {
  it('rotates the token inside the same family', async () => {
    const row = storedOf();
    fakeDb.enqueue([row], [{ id: row.id }], [rowOf()], []);
    const session = await refresh({ token: 'opaque' });
    expect(session.refresh_token).not.toBe('opaque');
    expect((await Tokens.verify(session.access_token)).id).toBe(OTHER_ID);
    expect(session.user.email).toBe('jane.doe@example.com');
    const values = fakeDb.arg('insert', 'values') as Record<string, unknown>;
    expect(values['family_id']).toBe(row.family_id);
    expect(values['token_hash']).toBe(Tokens.hash(session.refresh_token));
    expect(typeof (fakeDb.arg('update', 'set') as Record<string, unknown>)['revoked_at']).toBe(
      'number',
    );
  });

  it('issues the access token from the database role, not from a stale session', async () => {
    const row = storedOf();
    fakeDb.enqueue([row], [{ id: row.id }], [rowOf({ role: 'manager' })], []);
    const session = await refresh({ token: 'opaque' });
    expect((await Tokens.verify(session.access_token)).role).toBe('manager');
  });

  it('rejects an unknown token', async () => {
    fakeDb.enqueue([]);
    const error = await caught(refresh({ token: 'opaque' }));
    expect(error.code).toBe('auth.refresh.invalid');
    expect(error.status).toBe(401);
  });

  it('revokes the whole family and logs when a rotated token is reused', async () => {
    fakeDb.enqueue([storedOf({ revoked_at: 5 })], []);
    const error = await caught(refresh({ token: 'opaque' }));
    expect(error.code).toBe('auth.refresh.invalid');
    expect(revoked()).toBe(true);
    expect(log.events()).toEqual(['auth.refresh_reuse_detected']);
    expect(inserted()).toBe(false);
  });

  it('accepts a just-rotated token inside the grace window without revoking', async () => {
    fakeDb.enqueue(
      [storedOf({ revoked_at: Date.now() - 2000 })],
      [{ id: 'successor' }],
      [rowOf()],
      [],
    );
    const session = await refresh({ token: 'opaque' });
    expect(session.refresh_token).not.toBe('opaque');
    expect((fakeDb.arg('insert', 'values') as Record<string, unknown>)['family_id']).toBe(
      storedOf().family_id,
    );
    expect(revoked()).toBe(false);
    expect(log.create).not.toHaveBeenCalled();
  });

  it('does not grant the grace window when the family has no live token', async () => {
    fakeDb.enqueue([storedOf({ revoked_at: Date.now() - 2000 })], [], []);
    const error = await caught(refresh({ token: 'opaque' }));
    expect(error.code).toBe('auth.refresh.invalid');
    expect(inserted()).toBe(false);
    expect(log.events()).toEqual(['auth.refresh_reuse_detected']);
  });

  it('keeps reuse detection once the 10 second grace window has passed', async () => {
    fakeDb.enqueue([storedOf({ revoked_at: Date.now() - 11_000 })], []);
    const error = await caught(refresh({ token: 'opaque' }));
    expect(error.code).toBe('auth.refresh.invalid');
    expect(revoked()).toBe(true);
    expect(inserted()).toBe(false);
    expect(log.events()).toEqual(['auth.refresh_reuse_detected']);
  });

  it('revokes the family when the token expired', async () => {
    fakeDb.enqueue([storedOf({ expires_at: 1 })], []);
    const error = await caught(refresh({ token: 'opaque' }));
    expect(error.code).toBe('auth.refresh.invalid');
    expect(log.create).not.toHaveBeenCalled();
    expect(revoked()).toBe(true);
  });

  it('rejects when a concurrent request already claimed the token', async () => {
    fakeDb.enqueue([storedOf()], [], []);
    const error = await caught(refresh({ token: 'opaque' }));
    expect(error.code).toBe('auth.refresh.invalid');
    expect(inserted()).toBe(false);
  });

  it('rejects and revokes when the user is archived or gone', async () => {
    const row = storedOf();
    fakeDb.enqueue([row], [{ id: row.id }], [rowOf({ archived_at: 1 })], []);
    const archived = await caught(refresh({ token: 'opaque' }));
    fakeDb.reset();
    fakeDb.enqueue([row], [{ id: row.id }], [], []);
    const gone = await caught(refresh({ token: 'opaque' }));
    expect(archived.code).toBe('auth.refresh.invalid');
    expect(gone.code).toBe('auth.refresh.invalid');
    expect(inserted()).toBe(false);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(refresh({ token: 'opaque' }));
    expect(error.code).toBe('auth.refresh.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('auth.service.refresh');
  });
});
