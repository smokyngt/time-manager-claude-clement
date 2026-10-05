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

const { login } = await import('@/services/auth/login.js');
const { Tokens } = await import('@/lib/auth/tokens.js');

const hash = await Bun.password.hash('correct-password', { algorithm: 'argon2id' });

describe('auth.service.login', () => {
  it('issues a session, stores only the refresh token hash and writes an audit log', async () => {
    fakeDb.enqueue([makeRow({ password_hash: hash })], []);
    const session = await login({ email: 'Jane.Doe@Example.com', password: 'correct-password' });
    expect(session.user.id).toBe(OTHER_ID);
    expect(session.user).not.toHaveProperty('password_hash');
    expect(session.expires_in).toBe(900);
    const actor = await Tokens.verify(session.access_token);
    expect(actor).toEqual({ id: OTHER_ID, role: 'employee', team_ids: [] });
    const stored = fakeDb.arg('insert', 'values') as Record<string, unknown>;
    expect(stored['token_hash']).toBe(Tokens.hash(session.refresh_token));
    expect(stored['token_hash']).not.toBe(session.refresh_token);
    expect(logCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth.logged_in',
        metadata: { method: 'password', user_id: OTHER_ID },
      }),
    );
  });

  it('rejects a wrong password with the same error as an unknown email', async () => {
    fakeDb.enqueue([makeRow({ password_hash: hash })]);
    const wrong = await caught(login({ email: 'a@b.co', password: 'nope' }));
    fakeDb.enqueue([]);
    const unknown = await caught(login({ email: 'a@b.co', password: 'nope' }));
    expect(wrong.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(wrong.status).toBe(401);
    expect(unknown.code).toBe(wrong.code);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('rejects archived users and password-less users', async () => {
    fakeDb.enqueue([makeRow({ archived_at: 1, password_hash: hash })]);
    const archived = await caught(login({ email: 'a@b.co', password: 'correct-password' }));
    fakeDb.enqueue([makeRow({ password_hash: null })]);
    const microsoftOnly = await caught(login({ email: 'a@b.co', password: 'correct-password' }));
    expect(archived.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(microsoftOnly.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(login({ email: 'a@b.co', password: 'x' }));
    expect(error.code).toBe('AUTH_LOGIN_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('auth.service.login');
  });
});
