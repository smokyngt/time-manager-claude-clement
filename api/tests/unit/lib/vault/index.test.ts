import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Vault } from '@/lib/vault/index.js';

type Call = { init: RequestInit; url: string };

const original = Vault.transport;
const names = [
  'VAULT_ADDR',
  'VAULT_APPROLE_MOUNT',
  'VAULT_KV_MOUNT',
  'VAULT_NAMESPACE',
  'VAULT_ROLE_ID_FILE',
  'VAULT_SECRET_ID_FILE',
  'VAULT_SECRET_PATHS',
  'VAULT_TOKEN_FILE',
];
let calls: Call[] = [];
let directory = '';

const reply = (status: number, body: object): Response =>
  new Response(JSON.stringify(body), { status });

const route = (handler: (url: string, init: RequestInit) => Response): void => {
  Vault.transport = (url, init) => {
    calls.push({ init, url });

    return Promise.resolve(handler(url, init));
  };
};

const standard = (url: string): Response => {
  if (url.endsWith('/auth/approle/login'))
    return reply(200, { auth: { client_token: 's.abc', lease_duration: 3600, renewable: true } });
  if (url.endsWith('/secret/data/time-manager/api'))
    return reply(200, { data: { data: { HASH_KEY: 'h', JWT_ACCESS_SECRET: 'a', PORT: 8000 } } });
  if (url.endsWith('/secret/data/time-manager/shared'))
    return reply(200, { data: { data: { JWT_ACCESS_SECRET: 'b', METRICS_TOKEN: 'm' } } });

  return reply(404, { errors: [] });
};

beforeEach(() => {
  calls = [];
  directory = mkdtempSync(join(tmpdir(), 'vault-test-'));
  writeFileSync(join(directory, 'role'), 'role-1\n');
  writeFileSync(join(directory, 'secret'), 'secret-1\n');
  process.env.VAULT_ADDR = 'http://vault.test:8200/';
  process.env.VAULT_ROLE_ID_FILE = join(directory, 'role');
  process.env.VAULT_SECRET_ID_FILE = join(directory, 'secret');
});

afterEach(() => {
  Vault.stop();
  Vault.transport = original;
  for (const name of names) Reflect.deleteProperty(process.env, name);
  rmSync(directory, { force: true, recursive: true });
});

describe('Vault.enabled', () => {
  it('follows VAULT_ADDR', () => {
    expect(Vault.enabled()).toBe(true);
    Reflect.deleteProperty(process.env, 'VAULT_ADDR');
    expect(Vault.enabled()).toBe(false);
  });
});

describe('Vault.login', () => {
  it('sends the AppRole credentials and returns the lease', async () => {
    route(standard);

    expect(await Vault.login()).toBe(3600);
    expect(calls[0]?.url).toBe('http://vault.test:8200/v1/auth/approle/login');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      role_id: 'role-1',
      secret_id: 'secret-1',
    });
  });

  it('sends the namespace header', async () => {
    process.env.VAULT_NAMESPACE = 'team';
    route(standard);
    await Vault.login();

    expect((calls[0]?.init.headers as Record<string, string>)['X-Vault-Namespace']).toBe('team');
  });

  it('uses a token file without calling vault', async () => {
    writeFileSync(join(directory, 'token'), 'dev-token\n');
    process.env.VAULT_TOKEN_FILE = join(directory, 'token');
    route(standard);

    expect(await Vault.login()).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('throws vault.login.failed with the cause kept', async () => {
    route(() => reply(403, { errors: ['denied'] }));
    const error = await Vault.login().catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'vault.login.failed', status: 503 });
    expect((error as Error).cause).toBeInstanceOf(Error);
  });

  it('fails when the credential files are missing', async () => {
    Reflect.deleteProperty(process.env, 'VAULT_ROLE_ID_FILE');
    route(standard);

    expect(await Vault.login().catch((caught: unknown) => caught)).toMatchObject({
      code: 'vault.login.failed',
    });
  });
});

describe('Vault.read', () => {
  it('reads a KV v2 secret with the token and keeps string values', async () => {
    route(standard);
    await Vault.login();
    const secrets = await Vault.read('time-manager/api');
    const headers = calls[1]?.init.headers as Record<string, string>;

    expect(secrets).toEqual({ HASH_KEY: 'h', JWT_ACCESS_SECRET: 'a', PORT: '8000' });
    expect(headers['X-Vault-Token']).toBe('s.abc');
  });

  it('throws vault.read.failed without leaking values', async () => {
    route(standard);
    await Vault.login();
    const error = await Vault.read('missing').catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: 'vault.read.failed',
      metadata: { path: 'missing', route: 'vault.read' },
      status: 503,
    });
  });
});

describe('Vault.load', () => {
  it('returns an empty record when disabled', async () => {
    Reflect.deleteProperty(process.env, 'VAULT_ADDR');

    expect(await Vault.load()).toEqual({});
  });

  it('merges the default paths with later paths winning', async () => {
    route(standard);

    expect(await Vault.load()).toEqual({
      HASH_KEY: 'h',
      JWT_ACCESS_SECRET: 'b',
      METRICS_TOKEN: 'm',
      PORT: '8000',
    });
  });

  it('honours VAULT_SECRET_PATHS', async () => {
    process.env.VAULT_SECRET_PATHS = 'time-manager/shared';
    route(standard);

    expect(await Vault.load()).toEqual({ JWT_ACCESS_SECRET: 'b', METRICS_TOKEN: 'm' });
  });

  it('propagates a read failure', async () => {
    process.env.VAULT_SECRET_PATHS = 'nothing';
    route(standard);

    expect(await Vault.load().catch((caught: unknown) => caught)).toMatchObject({
      code: 'vault.read.failed',
    });
  });
});

describe('Vault.renew', () => {
  it('returns the renewed lease', async () => {
    route((url) =>
      url.endsWith('/renew-self')
        ? reply(200, { auth: { client_token: 's.abc', lease_duration: 7200, renewable: true } })
        : standard(url),
    );
    await Vault.login();

    expect(await Vault.renew()).toBe(7200);
  });

  it('logs in again when renewal fails', async () => {
    route((url) => (url.endsWith('/renew-self') ? reply(403, {}) : standard(url)));
    await Vault.login();

    expect(await Vault.renew()).toBe(3600);
    expect(calls.map((call) => call.url.split('/v1/')[1])).toEqual([
      'auth/approle/login',
      'auth/token/renew-self',
      'auth/approle/login',
    ]);
  });
});

describe('Vault.watch', () => {
  it('renews at two thirds of the ttl and stops cleanly', async () => {
    route((url) =>
      url.endsWith('/renew-self')
        ? reply(200, { auth: { client_token: 's.abc', lease_duration: 0, renewable: true } })
        : standard(url),
    );
    await Vault.login();
    Vault.watch(0.0015);
    await Bun.sleep(1200);
    Vault.stop();
    const seen = calls.length;
    await Bun.sleep(1200);

    expect(calls.some((call) => call.url.endsWith('/renew-self'))).toBe(true);
    expect(calls).toHaveLength(seen);
  });
});
