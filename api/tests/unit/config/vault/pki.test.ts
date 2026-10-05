import { afterEach, beforeEach, describe, expect, it, jest, mock } from 'bun:test';

import { environment, failure, fixture, stub } from './fixture.js';

import type { Fixture } from './fixture.js';

const restore = environment();
let ctx: Fixture;
let serial = 0;

const issued = (ttl: number) => () => {
  serial += 1;

  return {
    data: {
      ca_chain: ['INTERMEDIATE', 'ROOT'],
      certificate: `CERT-${serial}`,
      expiration: Math.floor(Date.now() / 1000) + ttl,
      issuing_ca: 'INTERMEDIATE',
      private_key: `KEY-${serial}`,
    },
    lease_duration: ttl,
  };
};

beforeEach(() => {
  jest.useFakeTimers();
  serial = 0;
  process.env['VAULT_PKI_ENABLED'] = 'true';
  ctx = fixture();
  ctx.config.client.write = mock(issued(86_400));
});

afterEach(() => {
  ctx.config.stop();
  jest.useRealTimers();
  restore();
});

describe('VaultPki', () => {
  it('issues from pki-internal/issue/api-server for the configured names', async () => {
    process.env['VAULT_PKI_COMMON_NAME'] = 'api';
    process.env['VAULT_PKI_ALT_NAMES'] = 'api.internal,localhost';
    process.env['VAULT_PKI_IP_SANS'] = '127.0.0.1';
    await ctx.config.pki.initialize();
    const [path, body] = ctx.mocks.write.mock.calls[0] as [
      string,
      Record<string, string>,
    ];
    expect(path).toBe('pki-internal/issue/api-server');
    expect(body['common_name']).toBe('api');
    expect(body['alt_names']).toBe('api.internal,localhost');
    expect(body['ip_sans']).toBe('127.0.0.1');
    expect(ctx.config.pki.creds()).toEqual({
      ca: 'INTERMEDIATE\nROOT',
      cert: 'CERT-1\nINTERMEDIATE',
      key: 'KEY-1',
    });
    expect(ctx.logs.join('\n')).not.toContain('KEY-1');
  });

  it('refuses to issue when disabled and to serve creds before issuance', async () => {
    process.env['VAULT_PKI_ENABLED'] = 'false';
    expect((await failure(ctx.config.pki.issue())).message).toContain('PKI is disabled');
    expect(() => ctx.config.pki.creds()).toThrow('PKI certificate has not been issued');
  });

  it('renews 1h before expiry and hot-swaps listeners', async () => {
    const seen: string[] = [];
    ctx.config.pki.onRenew((creds) => seen.push(creds.cert));
    await ctx.config.pki.initialize();
    jest.advanceTimersByTime(86_400_000 - 3_600_000 - 1000);
    expect(ctx.mocks.write).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx.mocks.write).toHaveBeenCalledTimes(2);
    expect(seen).toEqual(['CERT-2\nINTERMEDIATE']);
    expect(ctx.config.pki.creds().key).toBe('KEY-2');
    expect(ctx.config.pki.expires()).toBeGreaterThan(Date.now());
  });

  it('stops notifying unsubscribed listeners and keeps the old cert when renewal fails', async () => {
    const seen: string[] = [];
    const off = ctx.config.pki.onRenew((creds) => seen.push(creds.cert));
    off();
    await ctx.config.pki.initialize();
    stub(ctx, 'write', () => Promise.reject(new Error('denied')));
    jest.advanceTimersByTime(86_400_000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(seen).toEqual([]);
    expect(ctx.config.pki.creds().key).toBe('KEY-1');
    expect(ctx.logs.some((line) => line.startsWith('[PKI] renewal failed'))).toBe(true);
    ctx.config.client.write = mock(issued(86_400));
    jest.advanceTimersByTime(60_000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx.config.pki.creds().key).toBe('KEY-2');
  });

  it('rejects an incomplete reply', async () => {
    stub(ctx, 'write', () => Promise.resolve(({ data: { certificate: 'x' } })));
    expect((await failure(ctx.config.pki.issue())).message).toContain('incomplete certificate');
  });
});
