import { afterEach, beforeEach, describe, expect, it, jest } from 'bun:test';

import { fixture, stub } from './fixture.js';

import type { Fixture } from './fixture.js';

let ctx: Fixture;

beforeEach(() => {
  jest.useFakeTimers();
  ctx = fixture();
});

afterEach(() => {
  ctx.config.stop();
  jest.useRealTimers();
});

describe('VaultToken', () => {
  it('renews at 80% of the ttl and reschedules with the new ttl', async () => {
    ctx.config.token.schedule(100);
    jest.advanceTimersByTime(79_999);
    expect(ctx.mocks.tokenRenewSelf).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx.mocks.tokenRenewSelf).toHaveBeenCalledTimes(1);
    expect(ctx.config.token.active()).toBe(true);
    jest.advanceTimersByTime(80_000);
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx.mocks.tokenRenewSelf).toHaveBeenCalledTimes(2);
  });

  it('retries after a failed renewal without logging the error values', async () => {
    stub(ctx, 'tokenRenewSelf', () => Promise.reject(new Error('boom')));
    ctx.config.token.schedule(10);
    jest.advanceTimersByTime(8000);
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx.logs.some((line) => line.startsWith('[VAULT] token renewal failed'))).toBe(true);
    jest.advanceTimersByTime(30_000);
    await Promise.resolve();
    expect(ctx.mocks.tokenRenewSelf).toHaveBeenCalledTimes(2);
  });

  it('stops on shutdown and ignores non-positive ttl', () => {
    ctx.config.token.schedule(0);
    expect(ctx.config.token.active()).toBe(false);
    ctx.config.token.schedule(100);
    expect(ctx.config.token.active()).toBe(true);
    ctx.config.stop();
    expect(ctx.config.token.active()).toBe(false);
    jest.advanceTimersByTime(200_000);
    expect(ctx.mocks.tokenRenewSelf).not.toHaveBeenCalled();
  });
});
