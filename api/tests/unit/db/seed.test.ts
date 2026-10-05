import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Cipher } from '@/utils/crypto/cipher.js';
import { Digest } from '@/utils/crypto/digest.js';

import { FakeDb } from '../../support/db.js';
import { params } from '../services/auth/support.js';

const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
const end = mock(() => Promise.resolve());
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb, sql: { end } }));

const saved = { ...process.env };

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
  process.env = saved;
});

afterEach(() => {
  fakeDb.reset();
  mock.clearAllMocks();
  process.env = { ...saved };
});

const seed = async (tag: string): Promise<void> => {
  await import(`../../../src/db/seed.ts?${tag}`);
};

describe('db seed', () => {
  it('seals the admin identity, stores the email hash and looks it up by hash', async () => {
    process.env['SEED_ADMIN_EMAIL'] = ' Admin@Example.com ';
    process.env['SEED_ADMIN_PASSWORD'] = 'a-long-seed-password';
    fakeDb.enqueue([], []);
    await seed('create');
    expect(params(fakeDb.arg('select', 'where'))).toEqual([Digest.email('admin@example.com')]);
    const values = fakeDb.arg('insert', 'values') as Record<string, string>;
    expect(Cipher.open(values['email'] ?? '')).toBe('admin@example.com');
    expect(Cipher.open(values['first_name'] ?? '')).toBe('Admin');
    expect(Cipher.open(values['last_name'] ?? '')).toBe('Admin');
    expect(values['email_hash']).toBe(Digest.email('admin@example.com'));
    expect(values['role']).toBe('admin');
    expect(values['password_hash']).not.toBe('a-long-seed-password');
    expect(end).toHaveBeenCalled();
  });

  it('is idempotent when the admin hash already exists', async () => {
    process.env['SEED_ADMIN_EMAIL'] = 'admin@example.com';
    process.env['SEED_ADMIN_PASSWORD'] = 'a-long-seed-password';
    fakeDb.enqueue([{ id: 'x' }]);
    await seed('exists');
    expect(fakeDb.calls.some((call) => call.op === 'insert')).toBe(false);
  });
});
