import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import { caught, makeRow, OTHER_ID } from '../../../helpers/fixtures.js';

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

const { refresh } = await import('@/services/auth/refresh.js');
const { Tokens } = await import('@/lib/auth/tokens.js');

const stored = (overrides: Record<string, unknown> = {}) => ({
  created_at: 1,
  expires_at: Date.now() + 60_000,
  family_id: 'family-1',
  id: 'token-1',
  revoked_at: null,
  token_hash: 'hash',
  user_id: OTHER_ID,
  ...overrides,
});

describe('auth.service.refresh', () => {
  it('rotates the token inside the same family', async () => {
    fakeDb.enqueue([stored()], [{ id: 'token-1' }], [makeRow()], []);
    const session = await refresh({ token: 'opaque' });
    expect(session.refresh_token).not.toBe('opaque');
    expect((await Tokens.verify(session.access_token)).id).toBe(OTHER_ID);
    const inserted = fakeDb.arg('insert', 'values') as Record<string, unknown>;
    expect(inserted['family_id']).toBe('family-1');
    expect(inserted['token_hash']).toBe(Tokens.hash(session.refresh_token));
    expect(typeof (fakeDb.arg('update', 'set') as Record<string, unknown>)['revoked_at']).toBe(
      'number',
    );
  });

  it('rejects an unknown token', async () => {
    fakeDb.enqueue([]);
    const error = await caught(refresh({ token: 'opaque' }));
    expect(error.code).toBe('AUTH_SESSION_INVALID');
    expect(error.status).toBe(401);
  });

  it('revokes the whole family and logs when a rotated token is reused', async () => {
    fakeDb.enqueue([stored({ revoked_at: 5 })], []);
    const error = await caught(refresh({ token: 'opaque' }));
    expect(error.code).toBe('AUTH_SESSION_INVALID');
    expect(fakeDb.calls.some((call) => call.op === 'update' && call.method === 'set')).toBe(true);
    expect(logCreate).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'auth.refresh_reuse_detected' }),
    );
    expect(fakeDb.calls.some((call) => call.op === 'insert')).toBe(false);
  });

  it('revokes the family when the token expired', async () => {
    fakeDb.enqueue([stored({ expires_at: 1 })], []);
    const error = await caught(refresh({ token: 'opaque' }));
    expect(error.code).toBe('AUTH_SESSION_INVALID');
    expect(logCreate).not.toHaveBeenCalled();
    expect(fakeDb.calls.some((call) => call.op === 'update' && call.method === 'set')).toBe(true);
  });

  it('rejects when a concurrent request already claimed the token', async () => {
    fakeDb.enqueue([stored()], [], []);
    const error = await caught(refresh({ token: 'opaque' }));
    expect(error.code).toBe('AUTH_SESSION_INVALID');
    expect(fakeDb.calls.some((call) => call.op === 'insert')).toBe(false);
  });

  it('rejects when the user is archived or gone', async () => {
    fakeDb.enqueue([stored()], [{ id: 'token-1' }], [makeRow({ archived_at: 1 })], []);
    const archived = await caught(refresh({ token: 'opaque' }));
    fakeDb.enqueue([stored()], [{ id: 'token-1' }], [], []);
    const gone = await caught(refresh({ token: 'opaque' }));
    expect(archived.code).toBe('AUTH_SESSION_INVALID');
    expect(gone.code).toBe('AUTH_SESSION_INVALID');
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(refresh({ token: 'opaque' }));
    expect(error.code).toBe('AUTH_REFRESH_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('auth.service.refresh');
  });
});
