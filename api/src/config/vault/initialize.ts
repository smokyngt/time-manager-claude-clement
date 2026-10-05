import { readFile } from 'node:fs/promises';

import { Env } from '@/config/env.js';
import { vaultConfig } from '@/config/vault/index.js';
import { SENSITIVE_KEYS } from '@/config/vault/store.js';
import { VaultError, VaultUrl } from '@/config/vault/url.js';

import type { VaultConfig, VaultDocument } from '@/config/vault/index.js';

const JWT_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/token';
const DATABASE_PATH = 'secret/data/databases/postgres';
const SECRETS_PATH = 'secret/data/app/time-manager';

const production = (): boolean => Env.str('NODE_ENV', 'development') === 'production';

const missing = (error: unknown): boolean => error instanceof VaultError && error.status === 404;

const message = (error: unknown): string =>
  error instanceof Error ? error.message : 'unknown error';

/**
 * @route config.vault.initialize.kubernetes
 * @param {VaultConfig} config
 * @returns {Promise<number>}
 * @throws {VaultError}
 */
export const kubernetes = async (config: VaultConfig): Promise<number> => {
  const role = Env.opt('VAULT_K8S_ROLE');
  if (role === undefined) throw new VaultError('VAULT_K8S_ROLE is required');
  const file = Env.str('VAULT_K8S_JWT_PATH', JWT_PATH);
  let jwt: string;
  try {
    jwt = (await readFile(file, 'utf8')).trim();
  } catch (error) {
    throw new VaultError(`Kubernetes service account token is unreadable at ${file}`, {
      cause: error,
    });
  }
  if (jwt === '') throw new VaultError(`Kubernetes service account token at ${file} is empty`);
  const mount = Env.str('VAULT_K8S_MOUNT', 'kubernetes');
  const reply = await config.client.write(`auth/${mount}/login`, { jwt, role });
  const token = reply.auth?.client_token;
  if (typeof token !== 'string' || token === '')
    throw new VaultError(`Vault login failed for auth/${mount}/login: no client token`);
  config.client.authenticate(token);

  return Number(reply.auth?.lease_duration ?? 0);
};

/**
 * @route config.vault.initialize.login
 * @param {VaultConfig} config
 * @returns {Promise<void>}
 * @throws {VaultError}
 */
export const login = async (config: VaultConfig): Promise<void> => {
  const url = VaultUrl.resolve();
  const method = Env.str('VAULT_AUTH_METHOD', 'token');
  if (method === 'kubernetes') {
    config.client.configure({ url });
    const ttl = await kubernetes(config);
    config.token.login(() => kubernetes(config));
    config.token.schedule(ttl);
    await authenticate(config, false);

    return;
  }
  if (method !== 'token') throw new VaultError('VAULT_AUTH_METHOD must be token or kubernetes');
  const token = Env.opt('VAULT_TOKEN');
  if (token === undefined) throw new VaultError('VAULT_TOKEN is required');
  config.client.configure({ token, url });
  await authenticate(config);
};

/**
 * @route config.vault.initialize.authenticate
 * @param {VaultConfig} config
 * @param {boolean} schedule
 * @returns {Promise<void>}
 * @throws {VaultError}
 */
export const authenticate = async (
  config: VaultConfig,
  schedule: boolean = true,
): Promise<void> => {
  try {
    const reply = await config.client.lookupSelf();
    const ttl = Number(reply.data?.['ttl'] ?? 0);
    if (schedule && reply.data?.['renewable'] === true && ttl > 0) config.token.schedule(ttl);
  } catch (error) {
    if (error instanceof VaultError && (error.status === 401 || error.status === 403))
      throw new VaultError(
        `token rejected by Vault (HTTP ${error.status}): check that VAULT_TOKEN is valid, unexpired and attached to the app policy`,
        { cause: error, status: error.status },
      );
    if (error instanceof VaultError && error.status === 503)
      throw new VaultError('Vault is sealed or unavailable (HTTP 503)', {
        cause: error,
        status: 503,
      });
    throw error;
  }
};

/**
 * @route config.vault.initialize.compose
 * @param {VaultConfig} config
 * @returns {Promise<void>}
 * @throws {VaultError}
 */
export const compose = async (config: VaultConfig): Promise<void> => {
  if (config.store.has('DATABASE_URL')) return;
  const path = Env.str('VAULT_DATABASE_PATH', DATABASE_PATH);
  let document: VaultDocument;
  try {
    document = await config.read(path);
  } catch (error) {
    if (!production() && missing(error)) return;
    throw error;
  }
  const field = (name: string): string | undefined => {
    const value = document.data[name];

    return typeof value === 'string' && value !== '' ? value : undefined;
  };
  const username = field('username');
  const password = field('password');
  if (username === undefined || password === undefined) {
    if (!production()) return;
    throw new VaultError(`Vault document ${path} must hold username and password`);
  }
  const host = field('host') ?? 'db';
  const port = field('port') ?? '5432';
  const database = field('database') ?? 'timemanager';
  config.store.merge({
    DATABASE_URL: `postgres://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`,
  });
};

/**
 * @route config.vault.initialize.seed
 * @param {VaultConfig} config
 * @param {string} path
 * @param {VaultDocument | undefined} document
 * @param {Record<string, string | undefined>} env
 * @returns {Promise<void>}
 * @throws {VaultError}
 */
export const seed = async (
  config: VaultConfig,
  path: string,
  document: undefined | VaultDocument,
  env: Record<string, string | undefined> = process.env,
): Promise<void> => {
  if (production()) return;
  const existing = document?.data ?? {};
  const additions: Record<string, string> = {};
  for (const key of SENSITIVE_KEYS) {
    const value = env[key];
    if (value !== undefined && value !== '' && existing[key] === undefined) additions[key] = value;
  }
  const keys = Object.keys(additions);
  if (keys.length === 0) return;
  await config.write({
    cas: document?.version ?? 0,
    data: { ...existing, ...additions },
    path,
  });
  config.log.info(`[VAULT] seeded ${keys.length} missing key(s) into ${path}: ${keys.join(', ')}`);
};

/**
 * @route config.vault.initialize
 * @param {VaultConfig} config
 * @returns {Promise<void>}
 * @throws {VaultError}
 */
export const initialize = async (config: VaultConfig = vaultConfig): Promise<void> => {
  try {
    if (config.disabled) {
      config.store.load(process.env);
      config.log.info('[VAULT] disabled: configuration loaded from environment');

      return;
    }
    await login(config);
    const health = await config.client.health({ standbyok: true });
    if (!health.initialized) throw new VaultError('Vault is not initialized');
    if (health.sealed) throw new VaultError('Vault is sealed');
    const path = Env.str('VAULT_SECRETS_PATH', SECRETS_PATH);
    let document: undefined | VaultDocument;
    try {
      document = await config.read(path);
    } catch (error) {
      if (production() || !missing(error)) throw error;
    }
    config.store.load(process.env);
    config.store.merge(document?.data ?? {});
    await seed(config, path, document);
    await compose(config);
    if (config.pki.enabled()) await config.pki.initialize();
    config.log.info(`[OK] Vault: initialized (${path})`);
  } catch (error) {
    config.stop();
    throw new VaultError(`Vault initialization failed: ${message(error)}`, { cause: error });
  }
};
