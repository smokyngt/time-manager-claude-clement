import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../support/db.js';
import { actorOf, caught, OTHER_ID, rowOf } from './support.js';

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

const { create } = await import('@/services/user/create.js');
const { Cipher } = await import('@/utils/crypto/cipher.js');
const { Digest } = await import('@/utils/crypto/digest.js');

const actor = actorOf('admin');
const data = {
  email: 'Jane.Doe@Example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  password: 'a-long-password',
  phone_number: '+33 6 12 34 56 78',
};

describe('user.service.create', () => {
  it('seals personal text, hashes the email and the password, and writes an audit log', async () => {
    fakeDb.enqueue([rowOf()]);
    const { user } = await create({ actor, data });
    const values = fakeDb.arg('insert', 'values') as Record<string, string>;
    expect(values['email']).not.toContain('jane');
    expect(Cipher.open(values['email'] ?? '')).toBe('jane.doe@example.com');
    expect(values['email_hash']).toBe(Digest.email('jane.doe@example.com'));
    expect(Cipher.open(values['first_name'] ?? '')).toBe('Jane');
    expect(Cipher.open(values['last_name'] ?? '')).toBe('Doe');
    expect(Cipher.open(values['phone_number'] ?? '')).toBe('+33 6 12 34 56 78');
    expect(String(values['password_hash'])).toStartWith('$argon2id');
    expect(values['role']).toBe('employee');
    expect(user.object).toBe('user');
    expect(user.email).toBe('jane.doe@example.com');
    expect(user).not.toHaveProperty('password_hash');
    expect(user).not.toHaveProperty('email_hash');
    expect(logCreate).toHaveBeenCalledTimes(1);
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'user.created',
      metadata: { role: 'employee', user_id: OTHER_ID },
    });
  });

  it('stores null password hash and phone number when none are given', async () => {
    fakeDb.enqueue([rowOf({ password_hash: null })]);
    await create({ actor, data: { email: 'a@b.co', first_name: 'A', last_name: 'B' } });
    const values = fakeDb.arg('insert', 'values') as Record<string, unknown>;
    expect(values['password_hash']).toBeNull();
    expect(values['phone_number']).toBeNull();
  });

  it('normalizes the email before hashing', async () => {
    fakeDb.enqueue([rowOf()]);
    await create({ actor, data: { ...data, email: '  JANE.DOE@example.com ' } });
    const values = fakeDb.arg('insert', 'values') as Record<string, string>;
    expect(values['email_hash']).toBe(Digest.email('jane.doe@example.com'));
  });

  it('maps a unique violation to a 409 duplicate.key', async () => {
    fakeDb.enqueue(Object.assign(new Error('duplicate'), { code: '23505' }));
    const error = await caught(create({ actor, data }));
    expect(error.code).toBe('duplicate.key');
    expect(error.status).toBe(409);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(create({ actor, data }));
    expect(error.code).toBe('user.create.failed');
    expect(error.status).toBe(500);
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('user.service.create');
  });

  it('fails when the insert returns no row', async () => {
    fakeDb.enqueue([]);
    const error = await caught(create({ actor, data }));
    expect(error.code).toBe('user.create.failed');
  });
});
