import { afterAll, describe, expect, it, mock } from 'bun:test';

import { FakeDb } from '../../support/db.js';

const realDb = { ...(await import('@/db/client.js')) };
class RecordingDb extends FakeDb {
  public readonly executed: unknown[] = [];

  public override execute(statement?: unknown): ReturnType<FakeDb['execute']> {
    this.executed.push(statement);

    return super.execute();
  }
}

const names = (node: unknown, out: string[] = []): string[] => {
  if (typeof node !== 'object' || node === null) return out;
  if (node.constructor.name === 'Name' && 'value' in node && typeof node.value === 'string') {
    out.push(node.value);
  } else if ('queryChunks' in node && Array.isArray(node.queryChunks)) {
    for (const chunk of node.queryChunks) names(chunk, out);
  }

  return out;
};

const fakeDb = new RecordingDb();
const end = mock(() => Promise.resolve());
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb, sql: { end } }));

const saved = { ...process.env };

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
  process.env = saved;
});

const { Cipher } = await import('@/utils/crypto/cipher.js');

const OLD_KEY = Buffer.alloc(32, 1).toString('base64');
const NEW_KEY = Buffer.alloc(32, 2).toString('base64');

describe('db rotate', () => {
  it('re-seals encrypted user columns only and never touches email_hash', async () => {
    process.env['ENCRYPTION_KEY'] = OLD_KEY;
    process.env['ENCRYPTION_KEY_ID'] = 'k1';
    const email = Cipher.seal('jane@example.com');
    const first = Cipher.seal('Jane');
    process.env['ENCRYPTION_KEY'] = NEW_KEY;
    process.env['ENCRYPTION_KEY_ID'] = 'k2';
    process.env['ENCRYPTION_KEYS_PREVIOUS'] = `k1:${OLD_KEY}`;
    fakeDb.enqueue(
      [],
      [],
      [{ email, email_hash: 'hash-value', first_name: first, id: 'u1', last_name: first, phone_number: null }],
      [],
    );
    const tag = 'users';
    await import(`../../../src/db/rotate.ts?${tag}`);
    expect(end).toHaveBeenCalled();
    expect(fakeDb.executed).toHaveLength(4);
    const [select, update] = [fakeDb.executed[2], fakeDb.executed[3]].map((item) => names(item));
    expect(select).toEqual(['email', 'first_name', 'last_name', 'phone_number', 'users']);
    expect(update).toContain('email');
    expect(update).toContain('first_name');
    expect(update).not.toContain('phone_number');
    expect([...(select ?? []), ...(update ?? [])]).not.toContain('email_hash');
  });
});
