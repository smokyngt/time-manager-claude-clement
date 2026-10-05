import { afterEach, describe, expect, it } from 'bun:test';

import { Limiter } from '@/lib/auth/limiter.js';

afterEach(() => {
  Limiter.reset();
});

describe('Limiter', () => {
  it('keys accounts by the sha256 of the normalized email', () => {
    const expected = new Bun.CryptoHasher('sha256').update('jane@example.com').digest('hex');
    expect(Limiter.key('  Jane@Example.COM ')).toBe(expected);
    expect(Limiter.key('jane@example.com')).not.toContain('jane');
  });

  it('blocks after the configured number of failures and reports a retry delay', () => {
    for (let count = 0; count < 4; count += 1) Limiter.fail('a@b.co');
    expect(Limiter.blocked('a@b.co')).toBe(false);
    Limiter.fail('A@B.co');
    expect(Limiter.blocked('a@b.co')).toBe(true);
    expect(Limiter.blocked('other@b.co')).toBe(false);
    expect(Limiter.retry('a@b.co')).toBeGreaterThan(0);
    Limiter.clear('a@b.co');
    expect(Limiter.blocked('a@b.co')).toBe(false);
    expect(Limiter.retry('a@b.co')).toBe(1);
  });
});
