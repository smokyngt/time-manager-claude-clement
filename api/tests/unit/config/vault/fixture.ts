import { mock } from 'bun:test';

import { VaultConfig, VaultError } from '@/config/vault/index.js';

import type { VaultClient, VaultHealth, VaultReply } from '@/config/vault/index.js';

export type Fixture = {
  config: VaultConfig;
  logs: string[];
  mocks: Mocks;
};

type Method = 'health' | 'leaseRenew' | 'list' | 'lookupSelf' | 'read' | 'tokenRenewSelf' | 'write';

type Mocks = Record<Method, ReturnType<typeof mock>>;

export const healthy: VaultHealth = { initialized: true, sealed: false, standby: false };

export const document = (data: Record<string, unknown>, version = 1): VaultReply => ({
  data: { data, metadata: { version } },
});

export const rejection = (status: number): Error =>
  new VaultError(`Vault request failed (HTTP ${status})`, { status });

export const stub = (ctx: Fixture, method: Method, implementation: (...args: never[]) => unknown): void => {
  const fn = mock(implementation);
  ctx.mocks[method] = fn;
  (ctx.config.client as unknown as Record<Method, unknown>)[method] = fn;
};

export const fixture = (): Fixture => {
  const config = new VaultConfig();
  const logs: string[] = [];
  config.log = { info: (line) => logs.push(line), warn: (line) => logs.push(line) };
  const ctx: Fixture = { config, logs, mocks: {} as Mocks };
  stub(ctx, 'health', () => Promise.resolve(healthy));
  stub(ctx, 'leaseRenew', () => Promise.resolve({ lease_duration: 100, renewable: true }));
  stub(ctx, 'list', () => Promise.resolve([]));
  stub(ctx, 'lookupSelf', () => Promise.resolve({ data: { renewable: false, ttl: 0 } }));
  stub(ctx, 'read', (path: string) =>
    path.includes('databases') ? Promise.reject(rejection(404)) : Promise.resolve(document({})),
  );
  stub(ctx, 'tokenRenewSelf', () => Promise.resolve({ auth: { lease_duration: 100 } }));
  stub(ctx, 'write', () => Promise.resolve({}));

  return ctx;
};

export const client = (ctx: Fixture): VaultClient => ctx.config.client;

export const environment = (): (() => void) => {
  const saved = { ...process.env };

  return () => {
    process.env = { ...saved };
  };
};

export const failure = async (promise: Promise<unknown>): Promise<Error> => {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }

  throw new Error('expected the promise to reject');
};
