import { afterEach, beforeEach, describe, expect, it, setSystemTime } from 'bun:test';

import { Dek } from '@/services/encryption/envelope/dek.js';

import { Fixture } from './support.js';

beforeEach(() => {
  Dek.clear();
});

afterEach(() => {
  setSystemTime();
});

describe('Dek.read', () => {
  it('shares one Transit decrypt between 100 concurrent reads', async () => {
    const fixture = new Fixture();
    const row = await fixture.row('pii', 1);
    fixture.db.enqueue([row], [row]);
    const reads = await Promise.all(
      Array.from({ length: 100 }, () => Dek.read(fixture.runtime, 'pii')),
    );
    expect(reads.every((entry) => entry.version === 1 && entry.key.length === 32)).toBe(true);
    expect(fixture.vault.count('transit/decrypt/')).toBe(1);
    expect(fixture.db.calls.filter((call) => call.op === 'select' && call.method === 'from')).toHaveLength(2);
  });

  it('serves the plaintext cache for 5 minutes then unwraps again', async () => {
    const fixture = new Fixture();
    const row = await fixture.row('content', 2);
    fixture.db.enqueue([row], [row], [row], [row]);
    const start = Date.now();
    setSystemTime(new Date(start));
    await Dek.read(fixture.runtime, 'content', 2);
    setSystemTime(new Date(start + 4 * 60_000));
    await Dek.read(fixture.runtime, 'content', 2);
    expect(fixture.vault.count('transit/decrypt/')).toBe(1);
    setSystemTime(new Date(start + 5 * 60_000 + 1));
    await Dek.read(fixture.runtime, 'content', 2);
    expect(fixture.vault.count('transit/decrypt/')).toBe(2);
  });

  it('caches the active version for 30 seconds', async () => {
    const fixture = new Fixture();
    const first = await fixture.row('pii', 1);
    const second = await fixture.row('pii', 2);
    fixture.db.enqueue([first], [first], [second], [second]);
    const start = Date.now();
    setSystemTime(new Date(start));
    expect((await Dek.read(fixture.runtime, 'pii')).version).toBe(1);
    setSystemTime(new Date(start + 29_000));
    expect((await Dek.read(fixture.runtime, 'pii')).version).toBe(1);
    setSystemTime(new Date(start + 31_000));
    expect((await Dek.read(fixture.runtime, 'pii')).version).toBe(2);
  });

  it('evicts a rejected unwrap so the next read retries', async () => {
    const fixture = new Fixture();
    const row = await fixture.row('pii', 1);
    fixture.db.enqueue([row], [row], [row]);
    fixture.vault.failures.add(row.wrapped_key);
    const failures = await Promise.allSettled([
      Dek.read(fixture.runtime, 'pii'),
      Dek.read(fixture.runtime, 'pii'),
    ]);
    expect(failures.every((item) => item.status === 'rejected')).toBe(true);
    expect(fixture.vault.count('transit/decrypt/')).toBe(1);
    const reason = (failures[0] as PromiseRejectedResult).reason as { code: string };
    expect(reason.code).toBe('encryption.key.unavailable');
    fixture.vault.failures.delete(row.wrapped_key);
    const entry = await Dek.read(fixture.runtime, 'pii', 1);
    expect(entry.key).toHaveLength(32);
    expect(fixture.vault.count('transit/decrypt/')).toBe(2);
  });

  it('fails with encryption.key.unavailable when no active key exists', async () => {
    const fixture = new Fixture();
    fixture.db.enqueue([], []);
    const error = (await Dek.read(fixture.runtime, 'pii').catch((caught: unknown) => caught)) as {
      code: string;
      metadata: Record<string, unknown>;
    };
    expect(error.code).toBe('encryption.key.unavailable');
    expect(error.metadata['domain']).toBe('pii');
    expect(await Dek.read(fixture.runtime, 'pii').catch(() => 'retry')).toBe('retry');
  });
});
