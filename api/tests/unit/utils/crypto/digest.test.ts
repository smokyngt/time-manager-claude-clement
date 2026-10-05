import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { Digest } from '@/utils/crypto/digest.js';

import { key, snapshot } from './helpers.js';

let restore = (): void => undefined;

beforeEach(() => {
  restore = snapshot();
  process.env.HASH_KEY = key();
});

afterEach(() => {
  restore();
});

describe('Digest', () => {
  it('is stable hex sha256 sized', () => {
    const first = Digest.hash('value', 'email');
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(Digest.hash('value', 'email')).toBe(first);
  });

  it('separates purposes', () => {
    expect(Digest.hash('value', 'email')).not.toBe(Digest.hash('value', 'phone'));
  });

  it('depends on the key', () => {
    const before = Digest.hash('value', 'email');
    process.env.HASH_KEY = key();
    expect(Digest.hash('value', 'email')).not.toBe(before);
  });

  it('normalizes emails', () => {
    expect(Digest.email('  Alice@Example.COM ')).toBe(Digest.email('alice@example.com'));
    expect(Digest.email('alice@example.com')).toBe(Digest.hash('alice@example.com', 'email'));
    expect(Digest.email('a@example.com')).not.toBe(Digest.email('b@example.com'));
  });
});
