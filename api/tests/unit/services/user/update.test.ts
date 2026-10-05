import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../support/db.js';

import { actorOf, caught, MISSING_ID, OTHER_ID, rowOf } from './support.js';

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

const { update } = await import('@/services/user/update.js');
const { Cipher } = await import('@/utils/crypto/cipher.js');
const { Digest } = await import('@/utils/crypto/digest.js');

const actor = actorOf('admin');

const setCalls = (): Record<string, unknown>[] =>
  fakeDb.calls
    .filter((call) => call.op === 'update' && call.method === 'set')
    .map((call) => call.args[0] as Record<string, unknown>);

describe('user.service.update', () => {
  it('seals changed fields, rehashes the email and logs field names only', async () => {
    fakeDb.enqueue([rowOf()], []);
    await update({
      actor,
      data: { email: 'NEW@Example.com', first_name: 'Janet', phone_number: null },
      id: OTHER_ID,
    });
    const values = fakeDb.arg('update', 'set') as Record<string, string | null>;
    expect(Cipher.open(values['email'] ?? '')).toBe('new@example.com');
    expect(values['email_hash']).toBe(Digest.email('new@example.com'));
    expect(Cipher.open(values['first_name'] ?? '')).toBe('Janet');
    expect(values['phone_number']).toBeNull();
    expect(typeof values['updated_at']).toBe('number');
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'user.updated',
      metadata: { fields: ['email', 'first_name', 'phone_number'], user_id: OTHER_ID },
    });
  });

  it('returns the decrypted user', async () => {
    fakeDb.enqueue([rowOf({ first_name: Cipher.seal('Janet') })]);
    const { user } = await update({ actor, data: { first_name: 'Janet' }, id: OTHER_ID });
    expect(user.first_name).toBe('Janet');
    expect(user).not.toHaveProperty('email_hash');
  });

  it('seals a new phone number', async () => {
    fakeDb.enqueue([rowOf()]);
    await update({ actor, data: { phone_number: '+33 1 23 45 67 89' }, id: OTHER_ID });
    const values = fakeDb.arg('update', 'set') as Record<string, string>;
    expect(Cipher.open(values['phone_number'] ?? '')).toBe('+33 1 23 45 67 89');
  });

  it('hashes a new password', async () => {
    fakeDb.enqueue([rowOf()], []);
    await update({ actor, data: { password: 'another-long-password' }, id: OTHER_ID });
    const values = fakeDb.arg('update', 'set') as Record<string, unknown>;
    expect(values).not.toHaveProperty('password');
    expect(String(values['password_hash'])).toStartWith('$argon2id');
  });

  it('throws user.not.found when nothing matches', async () => {
    fakeDb.enqueue([]);
    const error = await caught(update({ actor, data: { first_name: 'A' }, id: MISSING_ID }));
    expect(error.code).toBe('user.not.found');
    expect(error.status).toBe(404);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('maps a unique violation to a 409 duplicate.key', async () => {
    fakeDb.enqueue(Object.assign(new Error('duplicate'), { cause: { code: '23505' } }));
    const error = await caught(update({ actor, data: { email: 'a@b.co' }, id: OTHER_ID }));
    expect(error.code).toBe('duplicate.key');
    expect(error.status).toBe(409);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(update({ actor, data: { first_name: 'A' }, id: OTHER_ID }));
    expect(error.code).toBe('user.update.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('user.service.update');
  });

  it('revokes sessions when the password, email or role changes', async () => {
    fakeDb.enqueue([rowOf()], []);
    await update({ actor, data: { role: 'manager' }, id: OTHER_ID });
    expect(setCalls()).toHaveLength(2);
    expect(typeof setCalls()[1]?.['revoked_at']).toBe('number');
  });

  it('does not revoke sessions for other fields', async () => {
    fakeDb.enqueue([rowOf()]);
    await update({ actor, data: { first_name: 'A' }, id: OTHER_ID });
    expect(setCalls()).toHaveLength(1);
  });

  it('requires the current password when changing your own', async () => {
    const hash = await Bun.password.hash('old-long-password', { algorithm: 'argon2id' });
    const self = actorOf('employee', OTHER_ID);
    fakeDb.enqueue([{ password_hash: hash }]);
    const missing = await caught(
      update({ actor: self, data: { password: 'new-long-password' }, id: OTHER_ID }),
    );
    fakeDb.enqueue([{ password_hash: hash }]);
    const wrong = await caught(
      update({
        actor: self,
        data: { current_password: 'wrong-long-password', password: 'new-long-password' },
        id: OTHER_ID,
      }),
    );
    expect(missing.code).toBe('user.password.invalid');
    expect(missing.status).toBe(403);
    expect(wrong.code).toBe('user.password.invalid');
    expect(setCalls()).toHaveLength(0);
  });

  it('accepts the right current password and never stores it', async () => {
    const hash = await Bun.password.hash('old-long-password', { algorithm: 'argon2id' });
    const self = actorOf('employee', OTHER_ID);
    fakeDb.enqueue([{ password_hash: hash }], [rowOf()], []);
    await update({
      actor: self,
      data: { current_password: 'old-long-password', password: 'new-long-password' },
      id: OTHER_ID,
    });
    expect(setCalls()[0]).not.toHaveProperty('current_password');
    expect(String(setCalls()[0]?.['password_hash'])).toStartWith('$argon2id');
    expect(typeof setCalls()[1]?.['revoked_at']).toBe('number');
  });
});
