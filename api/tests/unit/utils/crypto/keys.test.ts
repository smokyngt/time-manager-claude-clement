import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { AppError } from '@/lib/errors/index.js';
import { Keys } from '@/utils/crypto/keys.js';

import { key, snapshot } from './helpers.js';

let restore = (): void => undefined;

beforeEach(() => {
  restore = snapshot();
});

afterEach(() => {
  restore();
});

describe('Keys', () => {
  it('derives deterministic dev keys outside production', () => {
    expect(Keys.current().key.equals(Keys.current().key)).toBe(true);
    expect(Keys.current().key.length).toBe(32);
    expect(Keys.current().id).toBe('k1');
    expect(Keys.digest().length).toBe(32);
    expect(Keys.current().key.equals(Keys.digest())).toBe(false);
    expect(Keys.validate()).toEqual([]);
  });

  it('rejects a malformed key even in development', () => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(16).toString('base64');
    expect(() => Keys.current()).toThrow(AppError);
    process.env.ENCRYPTION_KEY = 'not base64!';
    expect(() => Keys.current()).toThrow(AppError);
  });

  it('parses previous keys', () => {
    const old = key();
    process.env.ENCRYPTION_KEYS_PREVIOUS = `a:${old}, b:${key()}`;
    expect(Keys.previous().map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(Keys.find('a')?.toString('base64')).toBe(old);
    expect(Keys.find('zzz')).toBeUndefined();
  });

  it('rejects bad previous entries', () => {
    process.env.ENCRYPTION_KEYS_PREVIOUS = key();
    expect(() => Keys.previous()).toThrow(AppError);
    process.env.ENCRYPTION_KEYS_PREVIOUS = `k1:${key()}`;
    expect(() => Keys.previous()).toThrow(AppError);
    process.env.ENCRYPTION_KEYS_PREVIOUS = `x:${Buffer.alloc(8).toString('base64')}`;
    expect(() => Keys.previous()).toThrow(AppError);
  });

  it('fails validation in production when keys are missing or short', () => {
    process.env.NODE_ENV = 'production';
    expect(Keys.validate().length).toBe(2);
    process.env.ENCRYPTION_KEY = Buffer.alloc(16).toString('base64');
    process.env.HASH_KEY = Buffer.alloc(16).toString('base64');
    const problems = Keys.validate();
    expect(problems.length).toBe(2);
    expect(problems.join(' ')).toContain('ENCRYPTION_KEY');
    expect(problems.join(' ')).toContain('HASH_KEY');
    expect(() => Keys.current()).toThrow(AppError);
  });

  it('passes validation in production with proper keys', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENCRYPTION_KEY = key();
    process.env.HASH_KEY = key();
    process.env.ENCRYPTION_KEYS_PREVIOUS = `old:${key()}`;
    expect(Keys.validate()).toEqual([]);
  });
});
