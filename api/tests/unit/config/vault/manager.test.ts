import { afterEach, beforeEach, describe, expect, it, jest } from 'bun:test';

import { fixture, healthy, stub } from './fixture.js';

import type { Fixture } from './fixture.js';

let ctx: Fixture;

beforeEach(() => {
  jest.useFakeTimers();
  ctx = fixture();
  stub(ctx, 'read', () => Promise.resolve(({
    data: { password: 'x' },
    lease_duration: 100,
    lease_id: 'database/creds/app/abc',
    renewable: true,
  })));
});

afterEach(() => {
  ctx.config.stop();
  jest.useRealTimers();
});

describe('VaultCache', () => {
  it('serves cached reads until the ttl expires and dedupes concurrent reads', async () => {
    const [first, second] = await Promise.all([
      ctx.config.cache.get('database/creds/app', 1000),
      ctx.config.cache.get('database/creds/app', 1000),
    ]);
    expect(first).toEqual({ password: 'x' });
    expect(second).toEqual({ password: 'x' });
    await ctx.config.cache.get('database/creds/app', 1000);
    expect(ctx.mocks.read).toHaveBeenCalledTimes(1);
    jest.setSystemTime(Date.now() + 1500);
    await ctx.config.cache.get('database/creds/app', 1000);
    expect(ctx.mocks.read).toHaveBeenCalledTimes(2);
  });

  it('renews the lease at 80% of its duration', async () => {
    await ctx.config.cache.get('database/creds/app');
    jest.advanceTimersByTime(79_999);
    expect(ctx.mocks.leaseRenew).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx.mocks.leaseRenew).toHaveBeenCalledWith('database/creds/app/abc');
  });

  it('drops the entry when lease renewal fails', async () => {
    stub(ctx, 'leaseRenew', () => Promise.reject(new Error('expired')));
    await ctx.config.cache.get('database/creds/app');
    jest.advanceTimersByTime(80_000);
    await Promise.resolve();
    await Promise.resolve();
    await ctx.config.cache.get('database/creds/app');
    expect(ctx.mocks.read).toHaveBeenCalledTimes(2);
  });

  it('invalidate forces a new read and cancels renewal', async () => {
    await ctx.config.cache.get('database/creds/app');
    ctx.config.cache.invalidate('database/creds/app');
    jest.advanceTimersByTime(200_000);
    expect(ctx.mocks.leaseRenew).not.toHaveBeenCalled();
    await ctx.config.cache.get('database/creds/app');
    expect(ctx.mocks.read).toHaveBeenCalledTimes(2);
  });

  it('refresh bypasses the cache', async () => {
    await ctx.config.cache.get('database/creds/app');
    await ctx.config.cache.refresh('database/creds/app');
    expect(ctx.mocks.read).toHaveBeenCalledTimes(2);
  });

  it('check reports Vault health without throwing', async () => {
    expect(await ctx.config.cache.check()).toBe(true);
    stub(ctx, 'health', () => Promise.resolve(({ ...healthy, sealed: true })));
    expect(await ctx.config.cache.check()).toBe(false);
    stub(ctx, 'health', () => Promise.reject(new Error('down')));
    expect(await ctx.config.cache.check()).toBe(false);
  });
});
