import { afterEach, describe, expect, it } from 'bun:test';

import { SECRET_KEYS, VaultStore } from '@/config/vault/store.js';

import { environment } from './fixture.js';

const restore = environment();

afterEach(restore);

describe('VaultStore', () => {
  it('returns typed values with defaults', () => {
    const store = new VaultStore();
    store.merge({ ENABLED: 'true', LIMIT: '25', LIST: 'a, b ,,c', NAME: 'x', RAW: 3 });
    expect(store.number('LIMIT', 1)).toBe(25);
    expect(store.number('MISSING', 7)).toBe(7);
    expect(store.text('NAME', 'd')).toBe('x');
    expect(store.text('MISSING', 'd')).toBe('d');
    expect(store.boolean('ENABLED', false)).toBe(true);
    expect(store.boolean('MISSING', true)).toBe(true);
    expect(store.list('LIST')).toEqual(['a', 'b', 'c']);
    expect(store.list('MISSING', ['z'])).toEqual(['z']);
    expect(store.optional('RAW')).toBe('3');
    expect(store.optional('MISSING')).toBeUndefined();
    expect(store.get('NAME')).toBe('x');
  });

  it('throws on non-numeric number() and unset get()', () => {
    const store = new VaultStore();
    store.merge({ FLAG: 'maybe', LIMIT: 'abc' });
    expect(() => store.number('LIMIT', 1)).toThrow('Configuration LIMIT must be a number');
    expect(() => store.boolean('FLAG', true)).toThrow('Configuration FLAG must be a boolean');
    expect(() => store.get('MISSING')).toThrow('Configuration MISSING is not set');
  });

  it('lets later merges override earlier values and ignores empty or non-scalar values', () => {
    const store = new VaultStore();
    store.merge({ A: 'env', B: 'keep' });
    store.merge({ A: 'vault', B: '', C: { nested: true }, D: null });
    expect(store.get('A')).toBe('vault');
    expect(store.get('B')).toBe('keep');
    expect(store.optional('C')).toBeUndefined();
    expect(store.optional('D')).toBeUndefined();
  });

  it('loads every env key outside production', () => {
    process.env['NODE_ENV'] = 'development';
    const store = new VaultStore();
    store.load({ ANYTHING: 'yes', DATABASE_URL: 'postgres://x' });
    expect(store.get('ANYTHING')).toBe('yes');
  });

  it('loads only SECRET_KEYS from env in production', () => {
    process.env['NODE_ENV'] = 'production';
    const store = new VaultStore();
    store.load({ ANYTHING: 'no', JWT_ACCESS_SECRET: 'no', [SECRET_KEYS[0] ?? '']: 'yes' });
    expect(store.optional('ANYTHING')).toBeUndefined();
    expect(store.optional('JWT_ACCESS_SECRET')).toBeUndefined();
    expect(store.get(SECRET_KEYS[0] ?? '')).toBe('yes');
  });
});
