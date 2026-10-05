import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Digest } from '@/utils/crypto/digest.js';

import { FakeDb } from '../../../support/db.js';
import { caught, installLog, OTHER_ID, params, rowOf } from './support.js';

const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));
const log = await installLog();

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
  log.restore();
});

const { Limiter } = await import('@/lib/auth/limiter.js');
const { Tokens } = await import('@/lib/auth/tokens.js');
const { login } = await import('@/services/auth/login.js');

afterEach(() => {
  mock.clearAllMocks();
  fakeDb.reset();
  Limiter.reset();
});

const hash = await Bun.password.hash('correct-password', { algorithm: 'argon2id' });

describe('auth.service.login', () => {
  it('looks the user up by email_hash, issues a session and writes an audit log', async () => {
    fakeDb.enqueue([rowOf({ password_hash: hash })], []);
    const session = await login({ email: ' Jane.Doe@Example.com ', password: 'correct-password' });
    expect(params(fakeDb.arg('select', 'where'))).toEqual([Digest.email('jane.doe@example.com')]);
    expect(session.user).toMatchObject({ email: 'jane.doe@example.com', id: OTHER_ID });
    expect(session.user).not.toHaveProperty('password_hash');
    expect(session.user).not.toHaveProperty('email_hash');
    expect(session.expires_in).toBe(900);
    expect(await Tokens.verify(session.access_token)).toEqual({
      id: OTHER_ID,
      role: 'employee',
      team_ids: [],
    });
    const stored = fakeDb.arg('insert', 'values') as Record<string, unknown>;
    expect(stored['token_hash']).toBe(Tokens.hash(session.refresh_token));
    expect(stored['token_hash']).not.toBe(session.refresh_token);
    expect(log.create).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth.logged_in',
        metadata: { method: 'password', user_id: OTHER_ID },
      }),
    );
  });

  it('rejects a wrong password with the same error as an unknown email', async () => {
    fakeDb.enqueue([rowOf({ password_hash: hash })]);
    const wrong = await caught(login({ email: 'a@b.co', password: 'nope' }));
    fakeDb.enqueue([]);
    const unknown = await caught(login({ email: 'c@d.co', password: 'nope' }));
    expect(wrong.code).toBe('auth.credentials.invalid');
    expect(wrong.status).toBe(401);
    expect(unknown.code).toBe(wrong.code);
    expect(log.create).not.toHaveBeenCalled();
  });

  it('rejects archived users and password-less users', async () => {
    fakeDb.enqueue([rowOf({ archived_at: 1, password_hash: hash })]);
    const archived = await caught(login({ email: 'a@b.co', password: 'correct-password' }));
    fakeDb.enqueue([rowOf({ password_hash: null })]);
    const microsoftOnly = await caught(login({ email: 'e@f.co', password: 'correct-password' }));
    expect(archived.code).toBe('auth.credentials.invalid');
    expect(microsoftOnly.code).toBe('auth.credentials.invalid');
  });

  it('locks the account after repeated failures whatever the case of the email', async () => {
    const max = 5;
    for (let attempt = 0; attempt < max; attempt += 1) {
      fakeDb.enqueue([]);
      await caught(login({ email: attempt % 2 === 0 ? 'Lock@B.co' : 'lock@b.co', password: 'x' }));
    }
    fakeDb.reset();
    fakeDb.enqueue([rowOf({ password_hash: hash })]);
    const error = await caught(login({ email: 'LOCK@b.co', password: 'correct-password' }));
    expect(error.code).toBe('auth.rate.limited');
    expect(error.status).toBe(429);
    expect(error.retry_after).toBeGreaterThan(0);
    expect(fakeDb.calls).toHaveLength(0);
    fakeDb.enqueue([]);
    const other = await caught(login({ email: 'other@b.co', password: 'x' }));
    expect(other.code).toBe('auth.credentials.invalid');
  });

  it('clears the failure counter after a successful login', async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      fakeDb.enqueue([]);
      await caught(login({ email: 'clear@b.co', password: 'x' }));
    }
    fakeDb.enqueue([rowOf({ password_hash: hash })], []);
    await login({ email: 'clear@b.co', password: 'correct-password' });
    expect(Limiter.blocked('clear@b.co')).toBe(false);
    fakeDb.enqueue([]);
    const error = await caught(login({ email: 'clear@b.co', password: 'x' }));
    expect(error.code).toBe('auth.credentials.invalid');
  });

  it('does not count infrastructure failures as credential failures', async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      fakeDb.enqueue(new Error('db down'));
      await caught(login({ email: 'down@b.co', password: 'x' }));
    }
    expect(Limiter.blocked('down@b.co')).toBe(false);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(login({ email: 'a@b.co', password: 'x' }));
    expect(error.code).toBe('auth.login.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('auth.service.login');
  });
});
