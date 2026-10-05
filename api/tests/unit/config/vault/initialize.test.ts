import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { initialize } from '@/config/vault/initialize.js';

import { document, environment, fixture, healthy, rejection, stub } from './fixture.js';

import type { Fixture } from './fixture.js';

const restore = environment();
let ctx: Fixture;

beforeEach(() => {
  process.env = {
    NODE_ENV: 'development',
    VAULT_TOKEN: 'token-value',
    VAULT_URL: 'http://127.0.0.1:8200',
  };
  ctx = fixture();
});

afterEach(() => {
  ctx.config.stop();
  restore();
});

describe('initialize', () => {
  it('runs the boot sequence and merges the Vault document over env', async () => {
    process.env['LOG_LEVEL'] = 'debug';
    process.env['PORT'] = '1';
    stub(ctx, 'read', () => Promise.resolve(document({ PORT: 9000 })));
    await initialize(ctx.config);
    expect(ctx.mocks.lookupSelf).toHaveBeenCalledTimes(1);
    expect(ctx.mocks.health).toHaveBeenCalledWith({ standbyok: true });
    expect(ctx.mocks.read).toHaveBeenCalledWith('secret/data/app/time-manager');
    expect(ctx.config.store.number('PORT', 0)).toBe(9000);
    expect(ctx.config.store.text('LOG_LEVEL', '')).toBe('debug');
    expect(ctx.logs.some((line) => line.startsWith('[OK] Vault:'))).toBe(true);
    expect(ctx.logs.join('\n')).not.toContain('token-value');
  });

  it('reads VAULT_SECRETS_PATH when provided', async () => {
    process.env['VAULT_SECRETS_PATH'] = 'secret/data/app/other';
    await initialize(ctx.config);
    expect(ctx.mocks.read).toHaveBeenCalledWith('secret/data/app/other');
  });

  it.each([401, 403])('fails fast with an actionable message on HTTP %d', async (status) => {
    stub(ctx, 'lookupSelf', () => Promise.reject(rejection(status)));
    const run = initialize(ctx.config);
    await expect(run).rejects.toThrow(/^Vault initialization failed: token rejected by Vault/);
    await expect(run).rejects.toThrow(`HTTP ${status}`);
    expect(ctx.mocks.read).not.toHaveBeenCalled();
  });

  it('requires VAULT_TOKEN', async () => {
    delete process.env['VAULT_TOKEN'];
    await expect(initialize(ctx.config)).rejects.toThrow('Vault initialization failed: VAULT_TOKEN is required');
  });

  it('refuses a sealed Vault', async () => {
    stub(ctx, 'health', () => Promise.resolve(({ ...healthy, sealed: true })));
    await expect(initialize(ctx.config)).rejects.toThrow('Vault initialization failed: Vault is sealed');
    expect(ctx.mocks.read).not.toHaveBeenCalled();
  });

  it('refuses an uninitialized Vault', async () => {
    stub(ctx, 'health', () => Promise.resolve(({ ...healthy, initialized: false })));
    await expect(initialize(ctx.config)).rejects.toThrow('Vault is not initialized');
  });

  it('refuses http in production', async () => {
    process.env['NODE_ENV'] = 'production';
    await expect(initialize(ctx.config)).rejects.toThrow(
      'Vault initialization failed: VAULT_URL must use https in production',
    );
    expect(ctx.mocks.lookupSelf).not.toHaveBeenCalled();
  });

  it('fails production boot when VAULT_URL is missing', async () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['VAULT_URL'];
    await expect(initialize(ctx.config)).rejects.toThrow('Vault initialization failed: VAULT_URL is required');
  });

  it('fails production boot when the document is missing', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['VAULT_URL'] = 'https://vault:8200';
    stub(ctx, 'read', () => Promise.reject(rejection(404)));
    await expect(initialize(ctx.config)).rejects.toThrow('Vault initialization failed');
  });

  it('wraps read failures', async () => {
    stub(ctx, 'read', () => Promise.reject(rejection(500)));
    await expect(initialize(ctx.config)).rejects.toThrow('Vault initialization failed: Vault request failed');
  });

  it('loads from env only when Vault is disabled outside production', async () => {
    delete process.env['VAULT_URL'];
    process.env['LOG_LEVEL'] = 'warn';
    expect(ctx.config.disabled).toBe(true);
    await initialize(ctx.config);
    expect(ctx.config.store.text('LOG_LEVEL', '')).toBe('warn');
    expect(ctx.mocks.lookupSelf).not.toHaveBeenCalled();
  });

  it('schedules renewal for renewable tokens', async () => {
    stub(ctx, 'lookupSelf', () => Promise.resolve(({ data: { renewable: true, ttl: 3600 } })));
    await initialize(ctx.config);
    expect(ctx.config.token.active()).toBe(true);
  });
});

describe('initialize in production', () => {
  beforeEach(() => {
    process.env['NODE_ENV'] = 'production';
    process.env['VAULT_URL'] = 'https://vault:8200';
  });

  it('loads only SECRET_KEYS from env and the rest from Vault', async () => {
    process.env['LOG_LEVEL'] = 'trace';
    process.env['DATABASE_URL'] = 'postgres://platform';
    process.env['JWT_ACCESS_SECRET'] = 'from-env';
    stub(ctx, 'read', () => Promise.resolve(document({ CORS_ORIGIN: 'https://app' })));
    await initialize(ctx.config);
    expect(ctx.config.store.optional('LOG_LEVEL')).toBeUndefined();
    expect(ctx.config.store.optional('JWT_ACCESS_SECRET')).toBeUndefined();
    expect(ctx.config.store.optional('DATABASE_URL')).toBe('postgres://platform');
    expect(ctx.config.store.optional('CORS_ORIGIN')).toBe('https://app');
    expect(ctx.mocks.write).not.toHaveBeenCalled();
  });

  it('composes DATABASE_URL from the Vault postgres document', async () => {
    ctx.config.client.read = mock(async (path: string) =>
      path.endsWith('databases/postgres')
        ? document({ database: 'tm', host: 'db', password: 'p@ss', username: 'app' })
        : document({}),
    );
    await initialize(ctx.config);
    expect(ctx.config.store.get('DATABASE_URL')).toBe('postgres://app:p%40ss@db:5432/tm');
  });
});

describe('dev seeding', () => {
  it('writes sensitive keys missing in Vault and keeps every other key', async () => {
    process.env['JWT_ACCESS_SECRET'] = 'env-access';
    process.env['JWT_REFRESH_SECRET'] = 'env-refresh';
    process.env['METRICS_TOKEN'] = 'env-metrics';
    ctx.config.client.read = mock(async () =>
      document({ CORS_ORIGIN: 'https://app', JWT_REFRESH_SECRET: 'vault-refresh' }, 4),
    );
    await initialize(ctx.config);
    expect(ctx.mocks.write).toHaveBeenCalledTimes(1);
    const [path, body] = ctx.mocks.write.mock.calls[0] as [
      string,
      { data: Record<string, string>; options: { cas: number } },
    ];
    expect(path).toBe('secret/data/app/time-manager');
    expect(body.options.cas).toBe(4);
    expect(body.data).toEqual({
      CORS_ORIGIN: 'https://app',
      JWT_ACCESS_SECRET: 'env-access',
      JWT_REFRESH_SECRET: 'vault-refresh',
      METRICS_TOKEN: 'env-metrics',
    });
    expect(ctx.config.store.get('JWT_REFRESH_SECRET')).toBe('vault-refresh');
    expect(ctx.logs.join('\n')).not.toContain('env-access');
  });

  it('creates the document when it does not exist yet', async () => {
    process.env['HASH_KEY'] = 'env-hash';
    stub(ctx, 'read', () => Promise.reject(rejection(404)));
    await initialize(ctx.config);
    const [, body] = ctx.mocks.write.mock.calls[0] as [
      string,
      { data: Record<string, string>; options: { cas: number } },
    ];
    expect(body.options.cas).toBe(0);
    expect(body.data).toEqual({ HASH_KEY: 'env-hash' });
  });

  it('does not write when nothing is missing', async () => {
    process.env['HASH_KEY'] = 'env-hash';
    stub(ctx, 'read', () => Promise.resolve(document({ HASH_KEY: 'vault-hash' })));
    await initialize(ctx.config);
    expect(ctx.mocks.write).not.toHaveBeenCalled();
  });
});
