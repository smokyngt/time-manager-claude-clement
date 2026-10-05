import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import { caught, makeActor, makeRow } from '../../../helpers/fixtures.js';

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

const actor = makeActor('admin');
const data = {
  email: 'Jane.Doe@Example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  password: 'a-long-password',
};

describe('user.service.create', () => {
  it('creates a user, hashes the password and writes an audit log', async () => {
    fakeDb.enqueue([makeRow()]);
    const { user } = await create({ actor, data });
    const values = fakeDb.arg('insert', 'values') as Record<string, unknown>;
    expect(values['email']).toBe('jane.doe@example.com');
    expect(values['password_hash']).not.toBe(data.password);
    expect(String(values['password_hash'])).toStartWith('$argon2id');
    expect(values['role']).toBe('employee');
    expect(user.object).toBe('user');
    expect(user).not.toHaveProperty('password_hash');
    expect(logCreate).toHaveBeenCalledTimes(1);
    expect(logCreate).toHaveBeenCalledWith(
      expect.objectContaining({ actor, event: 'user.created' }),
    );
  });

  it('stores a null hash when no password is given', async () => {
    fakeDb.enqueue([makeRow({ password_hash: null })]);
    await create({ actor, data: { email: 'a@b.co', first_name: 'A', last_name: 'B' } });
    expect((fakeDb.arg('insert', 'values') as Record<string, unknown>)['password_hash']).toBeNull();
  });

  it('maps a unique violation to a 409 conflict', async () => {
    fakeDb.enqueue(Object.assign(new Error('duplicate'), { code: '23505' }));
    const error = await caught(create({ actor, data }));
    expect(error.code).toBe('USER_CONFLICT');
    expect(error.status).toBe(409);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(create({ actor, data }));
    expect(error.code).toBe('USER_CREATE_ERROR');
    expect(error.status).toBe(500);
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('user.service.create');
  });

  it('fails when the insert returns no row', async () => {
    fakeDb.enqueue([]);
    const error = await caught(create({ actor, data }));
    expect(error.code).toBe('USER_CREATE_ERROR');
  });
});
