import { describe, expect, it } from 'bun:test';

import { Health } from '@/lib/lifecycle/health.js';

describe('Health.check', () => {
  it('is true when the probe resolves', async () => {
    expect(await Health.check(async () => 1, 50)).toBe(true);
  });

  it('is false when the probe rejects', async () => {
    expect(await Health.check(() => Promise.reject(new Error('down')), 50)).toBe(false);
  });

  it('is false when the probe exceeds the timeout', async () => {
    expect(await Health.check(() => new Promise(() => undefined), 20)).toBe(false);
  });
});
