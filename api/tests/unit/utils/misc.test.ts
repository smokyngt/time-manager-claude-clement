import { describe, expect, it } from 'bun:test';

import { Duration } from '@/utils/duration.js';
import { Password } from '@/utils/password.js';
import { Postgres } from '@/utils/postgres.js';
import { Time } from '@/utils/time.js';

describe('Duration.seconds', () => {
  it('parses units and falls back on invalid input', () => {
    expect(Duration.seconds('15m', 1)).toBe(900);
    expect(Duration.seconds('7d', 1)).toBe(604_800);
    expect(Duration.seconds('2h', 1)).toBe(7200);
    expect(Duration.seconds('45s', 1)).toBe(45);
    expect(Duration.seconds('soon', 7)).toBe(7);
  });
});

describe('Time.bound', () => {
  it('accepts epoch milliseconds and ISO dates', () => {
    expect(Time.bound(5)).toBe(5);
    expect(Time.bound('2026-01-01T00:00:00.000Z')).toBe(Date.UTC(2026, 0, 1));
    expect(Time.bound(undefined)).toBeUndefined();
    expect(Time.bound('garbage')).toBeUndefined();
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
