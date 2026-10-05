import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { AppError } from '@/lib/errors/base/registry.js';
import { Cipher } from '@/utils/crypto/cipher.js';

import { key, snapshot } from './helpers.js';

let restore = (): void => undefined;

const tamper = (sealed: string, index: number): string => {
  const parts = sealed.split('.');
  const bytes = Buffer.from(parts[index]!, 'base64url');
  bytes[0] = bytes[0]! ^ 0xff;
  parts[index] = bytes.toString('base64url');
  return parts.join('.');
};

beforeEach(() => {
  restore = snapshot();
  process.env.ENCRYPTION_KEY = key();
});

afterEach(() => {
  restore();
});

describe('Cipher', () => {
  it('round-trips and uses the documented format', () => {
    const sealed = Cipher.seal('hello world');
    expect(sealed).toMatch(/^v1\.k1\.[\w-]{16}\.[\w-]{22}\.[\w-]+$/);
    expect(Cipher.open(sealed)).toBe('hello world');
  });

  it('uses a fresh iv each time', () => {
    expect(Cipher.seal('same')).not.toBe(Cipher.seal('same'));
  });

  it('handles unicode and the empty string', () => {
    for (const value of ['', 'Zoë 日本語 🚀', 'a.b.c']) {
      expect(Cipher.open(Cipher.seal(value))).toBe(value);
    }
  });

  it('detects tampering of iv, tag and ciphertext', () => {
    const sealed = Cipher.seal('secret');
    for (const index of [2, 3, 4]) {
      expect(() => Cipher.open(tamper(sealed, index))).toThrow(AppError);
    }
  });

  it('fails with the registered error', () => {
    try {
      Cipher.open(tamper(Cipher.seal('secret'), 4));
      throw new Error('expected failure');
    } catch (error) {
      expect(AppError.is(error)).toBe(true);
      expect((error as AppError).code).toBe('crypto.decrypt.failed');
      expect((error as AppError).status).toBe(500);
    }
  });

  it('rejects malformed values and a changed key id', () => {
    expect(() => Cipher.open('nope')).toThrow(AppError);
    expect(() => Cipher.open('v2.k1.a.b.c')).toThrow(AppError);
    const sealed = Cipher.seal('secret');
    expect(() => Cipher.open(sealed.replace('.k1.', '.k9.'))).toThrow(AppError);
  });

  it('fails with the wrong key', () => {
    const sealed = Cipher.seal('secret');
    process.env.ENCRYPTION_KEY = key();
    expect(() => Cipher.open(sealed)).toThrow(AppError);
  });

  it('opens with previous keys and rotates to the current one', () => {
    const old = process.env.ENCRYPTION_KEY!;
    const sealed = Cipher.seal('secret');
    process.env.ENCRYPTION_KEY = key();
    process.env.ENCRYPTION_KEY_ID = 'k2';
    process.env.ENCRYPTION_KEYS_PREVIOUS = `k1:${old}`;
    expect(Cipher.open(sealed)).toBe('secret');
    expect(Cipher.current(sealed)).toBe(false);
    const rotated = Cipher.rotate(sealed);
    expect(rotated.split('.')[1]).toBe('k2');
    expect(Cipher.open(rotated)).toBe('secret');
    expect(Cipher.rotate(rotated)).toBe(rotated);
    delete process.env.ENCRYPTION_KEYS_PREVIOUS;
    expect(() => Cipher.open(sealed)).toThrow(AppError);
    expect(Cipher.open(rotated)).toBe('secret');
  });

  it('supports nullable variants', () => {
    expect(Cipher.nullable.seal(null)).toBeNull();
    expect(Cipher.nullable.open(null)).toBeNull();
    expect(Cipher.nullable.rotate(null)).toBeNull();
    const sealed = Cipher.nullable.seal('x')!;
    expect(Cipher.nullable.open(sealed)).toBe('x');
    expect(Cipher.nullable.rotate(sealed)).toBe(sealed);
  });

  it('works with derived dev keys outside production', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(Cipher.open(Cipher.seal('dev'))).toBe('dev');
  });
});
