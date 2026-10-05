import { describe, expect, it } from 'bun:test';

import { Password } from '@/utils/password.js';
import { Postgres } from '@/utils/postgres.js';
import { Time } from '@/utils/time.js';

describe('Time.seconds', () => {
  it('parses units and rejects invalid input', () => {
    expect(Time.seconds('15m')).toBe(900);
    expect(Time.seconds('7d')).toBe(604_800);
    expect(Time.seconds('2h')).toBe(7200);
    expect(Time.seconds('45s')).toBe(45);
    expect(() => Time.seconds('soon')).toThrow('validation.error');
  });
});

describe('Time.bound', () => {
  it('accepts epoch milliseconds and ISO dates', () => {
    expect(Time.bound(5)).toBe(5);
    expect(Time.bound('2026-01-01T00:00:00.000Z')).toBe(Date.UTC(2026, 0, 1));
    expect(Time.bound(undefined)).toBeUndefined();
    expect(() => Time.bound('garbage')).toThrow('validation.error');
  });
});

describe('Postgres.conflict', () => {
  it('detects unique violations, also when nested', () => {
    expect(Postgres.conflict({ code: '23505' })).toBe(true);
    expect(Postgres.conflict({ cause: { code: '23505' } })).toBe(true);
    expect(Postgres.conflict({ code: '42P01' })).toBe(false);
    expect(Postgres.conflict(null)).toBe(false);
  });
});

describe('Password', () => {
  it('hashes with argon2id and verifies', async () => {
    const hash = await Password.hash('a-long-password');
    expect(hash).toStartWith('$argon2id$');
    expect(await Password.verify('a-long-password', hash)).toBe(true);
    expect(await Password.verify('wrong', hash)).toBe(false);
  });

  it('never validates when there is no stored hash', async () => {
    expect(await Password.verify('anything', null)).toBe(false);
  });
});
