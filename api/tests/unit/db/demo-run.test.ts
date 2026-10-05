import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Cipher } from '@/utils/crypto/cipher.js';
import { Digest } from '@/utils/crypto/digest.js';

import { FakeDb } from '../../support/db.js';
import { params } from '../services/auth/support.js';

const realDb = { ...(await import('@/db/client.js')) };
const fakeDb = new FakeDb();
await mock.module('@/db/client.js', () => ({ ...realDb, db: fakeDb }));

afterAll(() => {
  void mock.module('@/db/client.js', () => realDb);
});

afterEach(() => {
  fakeDb.reset();
});

const { Demo } = await import('@/db/demo.js');

const ids = (count: number): { id: string }[] =>
  Array.from({ length: count }, (_, index) => ({ id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}` }));

describe('Demo.run', () => {
  it('skips when the marker is found through its email hash', async () => {
    fakeDb.enqueue([{ id: 'x' }]);
    const counts = await Demo.run();
    expect(counts.skipped).toBe(true);
    expect(params(fakeDb.arg('select', 'where'))).toEqual([Digest.email(Demo.MARKER)]);
    expect(fakeDb.calls.some((call) => call.op === 'insert')).toBe(false);
  });

  it('inserts sealed users, teams and clock notes', async () => {
    fakeDb.enqueue([], ids(2), ids(12), ids(3), [], []);
    const counts = await Demo.run();
    expect(counts.skipped).toBe(false);
    const inserts = fakeDb.calls.filter((call) => call.op === 'insert' && call.method === 'values');
    const [managers, employees, teams, , clocks] = inserts.map((call) => call.args[0]);
    const manager = (managers as Record<string, string>[])[0] ?? {};
    expect(Cipher.open(manager['email'] ?? '')).toBe(Demo.MARKER);
    expect(manager['email_hash']).toBe(Digest.email(Demo.MARKER));
    for (const row of employees as Record<string, string>[]) {
      expect(row['email']).toMatch(/^v1\./);
      expect(row['first_name']).toMatch(/^v1\./);
      expect(row['last_name']).toMatch(/^v1\./);
      expect(row['email_hash']).toHaveLength(64);
    }
    for (const row of teams as Record<string, string>[]) {
      expect(row['name']).toMatch(/^v1\./);
      expect(row['description']).toMatch(/^v1\./);
    }
    const notes = (clocks as Record<string, string | null>[]).map((row) => row['note']);
    expect(notes.every((note) => note === null || note.startsWith('v1.'))).toBe(true);
  });
});
