import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../support/db.js';

import { caught, MISSING_ID, OTHER_ID, rowOf } from './support.js';

const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
});

afterEach(() => {
  fakeDb.reset();
});

const { retrieve } = await import('@/services/user/retrieve.js');

describe('user.service.retrieve', () => {
  it('returns the decrypted public entity', async () => {
    fakeDb.enqueue([rowOf({ phone_number: (await import('@/utils/crypto/cipher.js')).Cipher.seal('+33 6 12 34 56 78') })]);
    const { user } = await retrieve({ id: OTHER_ID });
    expect(user).toMatchObject({
      email: 'jane.doe@example.com',
      first_name: 'Jane',
      id: OTHER_ID,
      last_name: 'Doe',
      object: 'user',
      phone_number: '+33 6 12 34 56 78',
    });
    expect(user).not.toHaveProperty('password_hash');
    expect(user).not.toHaveProperty('email_hash');
  });

  it('throws user.not.found for an unknown id', async () => {
    fakeDb.enqueue([]);
    const error = await caught(retrieve({ id: MISSING_ID }));
    expect(error.code).toBe('user.not.found');
    expect(error.status).toBe(404);
    expect(error.metadata['user_id']).toBe(MISSING_ID);
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(retrieve({ id: OTHER_ID }));
    expect(error.code).toBe('user.retrieve.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('user.service.retrieve');
  });
});
