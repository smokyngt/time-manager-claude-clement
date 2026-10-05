import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../helpers/fake-db.js';
import { OTHER_ID } from '../../helpers/fixtures.js';

const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
});

afterEach(() => {
  fakeDb.reset();
});

const { Sessions } = await import('@/lib/auth/sessions.js');

describe('Sessions.revoke', () => {
  it('revokes every live refresh token of the user', async () => {
    fakeDb.enqueue([]);
    await Sessions.revoke({ user_id: OTHER_ID });
    const set = fakeDb.arg('update', 'set') as Record<string, unknown>;
    expect(typeof set['revoked_at']).toBe('number');
    expect(fakeDb.calls.some((call) => call.op === 'update' && call.method === 'where')).toBe(true);
  });
});

describe('Sessions.purge', () => {
  it('deletes expired and long-revoked tokens and reports the count', async () => {
    fakeDb.enqueue([{ id: 'a' }, { id: 'b' }]);
    const result = await Sessions.purge();
    expect(result).toEqual({ deleted: 2 });
    expect(fakeDb.calls.some((call) => call.op === 'delete' && call.method === 'where')).toBe(true);
  });
});
