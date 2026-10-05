import { beforeEach, describe, expect, it } from 'bun:test';

import { open, openNullable, seal, sealNullable } from '@/services/encryption/envelope/cipher.js';
import { Dek } from '@/services/encryption/envelope/dek.js';
import { email, hash } from '@/services/encryption/envelope/digest.js';
import { KEY_DOMAINS } from '@/services/encryption/envelope/keys.js';

import { Fixture } from './support.js';

import type { KeyDomain } from '@/services/encryption/envelope/keys.js';

const FORMAT = /^v1\.(pii|content|hash)\.\d+\.[\w-]{16}\.[\w-]{22}\.[\w-]*$/;

const ready = async (fixture: Fixture, domain: KeyDomain, version = 1): Promise<void> => {
  const row = await fixture.row(domain, version);
  fixture.db.enqueue([row], [row]);
};

const flip = (sealed: string, index: number): string => {
  const parts = sealed.split('.');
  const bytes = Buffer.from(parts[index]!, 'base64url');
  bytes[0] = bytes[0]! ^ 0xff;
  parts[index] = bytes.toString('base64url');

  return parts.join('.');
};

beforeEach(() => {
  Dek.clear();
});

describe('seal and open', () => {
  for (const domain of KEY_DOMAINS) {
    it(`round-trips in the ${domain} domain with the documented format`, async () => {
      const fixture = new Fixture();
      await ready(fixture, domain, 3);
      const sealed = await seal(fixture.runtime, domain, 'Zoë Müller +33 6 12');
      expect(sealed).toMatch(FORMAT);
      expect(sealed.startsWith(`v1.${domain}.3.`)).toBe(true);
      expect(sealed).not.toContain('Zo');
      expect(await open(fixture.runtime, sealed)).toBe('Zoë Müller +33 6 12');
    });
  }

  it('uses a fresh iv per value', async () => {
    const fixture = new Fixture();
    await ready(fixture, 'pii');
    expect(await seal(fixture.runtime, 'pii', 'same')).not.toBe(
      await seal(fixture.runtime, 'pii', 'same'),
    );
  });

  it('round-trips the empty string and nullable values', async () => {
    const fixture = new Fixture();
    await ready(fixture, 'content');
    expect(await open(fixture.runtime, await seal(fixture.runtime, 'content', ''))).toBe('');
    expect(await sealNullable(fixture.runtime, 'content', null)).toBeNull();
    expect(await openNullable(fixture.runtime, null)).toBeNull();
    const sealed = await sealNullable(fixture.runtime, 'content', 'note');
    expect(await openNullable(fixture.runtime, sealed)).toBe('note');
  });

  it('detects tampering of every segment', async () => {
    const fixture = new Fixture();
    await ready(fixture, 'pii');
    const sealed = await seal(fixture.runtime, 'pii', 'secret value');
    for (const index of [3, 4, 5]) {
      const error = (await open(fixture.runtime, flip(sealed, index)).catch(
        (caught: unknown) => caught,
      )) as { code: string };
      expect(error.code).toBe('encryption.decrypt.failed');
    }
  });

  it('binds the domain through the associated data', async () => {
    const fixture = new Fixture();
    await ready(fixture, 'pii');
    const sealed = await seal(fixture.runtime, 'pii', 'secret value');
    const swapped = sealed.replace('v1.pii.', 'v1.content.');
    const content = await fixture.row('content', 1);
    fixture.db.enqueue([content]);
    const error = (await open(fixture.runtime, swapped).catch((caught: unknown) => caught)) as {
      code: string;
    };
    expect(error.code).toBe('encryption.decrypt.failed');
  });

  it('rejects malformed values without touching the database', async () => {
    const fixture = new Fixture();
    for (const value of ['', 'garbage', 'v1.pii.1.a.b', 'v2.pii.1.a.b.c', 'v1.other.1.a.b.c', 'v1.pii.0.a.b.c', 'v1.pii.1.AA.AA.AA']) {
      const error = (await open(fixture.runtime, value).catch((caught: unknown) => caught)) as {
        code: string;
      };
      expect(error.code).toBe('encryption.decrypt.failed');
    }
    expect(fixture.db.calls).toHaveLength(0);
  });

  it('opens values sealed with an older decrypt-only version', async () => {
    const fixture = new Fixture();
    const old = await fixture.row('pii', 1, 'decrypt-only');
    fixture.db.enqueue([old], [old]);
    const sealed = await seal(fixture.runtime, 'pii', 'written under v1');
    const current = await fixture.row('pii', 2);
    Dek.clear();
    fixture.db.enqueue([current], [current]);
    const fresh = await seal(fixture.runtime, 'pii', 'written under v2');
    expect(fresh.startsWith('v1.pii.2.')).toBe(true);
    fixture.db.enqueue([old]);
    expect(await open(fixture.runtime, sealed)).toBe('written under v1');
    expect(await open(fixture.runtime, fresh)).toBe('written under v2');
  });

  it('never exposes plaintext or key material in errors or logs', async () => {
    const fixture = new Fixture();
    const row = await fixture.row('pii', 1);
    fixture.vault.failures.add(row.wrapped_key);
    fixture.db.enqueue([row], [row]);
    const error = (await seal(fixture.runtime, 'pii', 'top secret').catch(
      (caught: unknown) => caught,
    )) as { code: string; metadata: Record<string, unknown> };
    expect(error.code).toBe('encryption.key.unavailable');
    expect(JSON.stringify(error.metadata)).not.toContain('vault:');
    expect(JSON.stringify(error.metadata)).not.toContain('top secret');
    expect([...fixture.infos, ...fixture.errors].join('')).not.toContain('top secret');
  });
});

describe('hash', () => {
  it('is stable for the same purpose and value', async () => {
    const fixture = new Fixture();
    await ready(fixture, 'hash');
    const first = await hash(fixture.runtime, 'email', 'a@b.co');
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(await hash(fixture.runtime, 'email', 'a@b.co')).toBe(first);
    expect(await hash(fixture.runtime, 'email', 'other@b.co')).not.toBe(first);
  });

  it('separates purposes by subkey', async () => {
    const fixture = new Fixture();
    await ready(fixture, 'hash');
    expect(await hash(fixture.runtime, 'email', 'x')).not.toBe(await hash(fixture.runtime, 'phone', 'x'));
  });

  it('differs between key versions and can address one explicitly', async () => {
    const fixture = new Fixture();
    const first = await fixture.row('hash', 1, 'decrypt-only');
    const second = await fixture.row('hash', 2);
    fixture.db.enqueue([second], [second], [first]);
    const current = await hash(fixture.runtime, 'email', 'x');
    const legacy = await hash(fixture.runtime, 'email', 'x', 1);
    expect(current).not.toBe(legacy);
  });

  it('normalizes emails', async () => {
    const fixture = new Fixture();
    await ready(fixture, 'hash');
    const canonical = await email(fixture.runtime, 'user@example.com');
    expect(await email(fixture.runtime, '  User@Example.COM ')).toBe(canonical);
    expect(canonical).toBe(await hash(fixture.runtime, 'email', 'user@example.com'));
  });
});
