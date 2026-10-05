import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../../helpers/fake-db.js';
import { caught, makeActor, makeRow, MISSING_ID, OTHER_ID } from '../../../helpers/fixtures.js';

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

const actor = makeActor('admin');

const setCalls = (): Record<string, unknown>[] =>
  fakeDb.calls
    .filter((call) => call.op === 'update' && call.method === 'set')
    .map((call) => call.args[0] as Record<string, unknown>);

describe('user.service.update', () => {
  it('updates fields, lowercases the email and writes an audit log with field names only', async () => {
    fakeDb.enqueue([makeRow({ first_name: 'Janet' })]);
    const { user } = await update({
      actor,
      data: { email: 'NEW@Example.com', first_name: 'Janet', phone_number: null },
      id: OTHER_ID,
    });
    const values = fakeDb.arg('update', 'set') as Record<string, unknown>;
    expect(values['email']).toBe('new@example.com');
    expect(values['phone_number']).toBeNull();
    expect(typeof values['updated_at']).toBe('number');
    expect(user.first_name).toBe('Janet');
    expect(logCreate).toHaveBeenCalledWith({
      actor,
      event: 'user.updated',
      metadata: { fields: ['email', 'first_name', 'phone_number'], user_id: OTHER_ID },
    });
  });

  it('hashes a new password', async () => {
    fakeDb.enqueue([makeRow()]);
    await update({ actor, data: { password: 'another-long-password' }, id: OTHER_ID });
    const values = fakeDb.arg('update', 'set') as Record<string, unknown>;
    expect(values).not.toHaveProperty('password');
    expect(String(values['password_hash'])).toStartWith('$argon2id');
  });

  it('throws USER_NOT_FOUND when nothing matches', async () => {
    fakeDb.enqueue([]);
    const error = await caught(update({ actor, data: { first_name: 'A' }, id: MISSING_ID }));
    expect(error.code).toBe('USER_NOT_FOUND');
    expect(error.status).toBe(404);
    expect(logCreate).not.toHaveBeenCalled();
  });

  it('maps a unique violation to a 409 conflict', async () => {
    fakeDb.enqueue(Object.assign(new Error('duplicate'), { cause: { code: '23505' } }));
    const error = await caught(update({ actor, data: { email: 'a@b.co' }, id: OTHER_ID }));
    expect(error.code).toBe('USER_CONFLICT');
  });

  it('wraps unexpected failures and keeps the cause', async () => {
    const failure = new Error('db down');
    fakeDb.enqueue(failure);
    const error = await caught(update({ actor, data: { first_name: 'A' }, id: OTHER_ID }));
    expect(error.code).toBe('USER_UPDATE_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('user.service.update');
  });

  it('revokes sessions when the password, email or role changes', async () => {
    fakeDb.enqueue([makeRow()], []);
    await update({ actor, data: { role: 'manager' }, id: OTHER_ID });
    expect(setCalls()).toHaveLength(2);
    expect(typeof setCalls()[1]?.['revoked_at']).toBe('number');
  });

  it('does not revoke sessions for other fields', async () => {
    fakeDb.enqueue([makeRow()]);
    await update({ actor, data: { first_name: 'A' }, id: OTHER_ID });
    expect(setCalls()).toHaveLength(1);
  });

  it('requires the current password when changing your own', async () => {
    const hash = await Bun.password.hash('old-long-password', { algorithm: 'argon2id' });
    const self = makeActor('employee', OTHER_ID);
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
    expect(missing.code).toBe('USER_PASSWORD_INVALID');
    expect(missing.status).toBe(403);
    expect(wrong.code).toBe('USER_PASSWORD_INVALID');
    expect(setCalls()).toHaveLength(0);
  });

  it('accepts the right current password and never stores it', async () => {
    const hash = await Bun.password.hash('old-long-password', { algorithm: 'argon2id' });
    const self = makeActor('employee', OTHER_ID);
    fakeDb.enqueue([{ password_hash: hash }], [makeRow()], []);
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
