import { readFile } from 'node:fs/promises';

import { VaultLoginError, VaultReadError } from '@/lib/vault/errors.js';

export type VaultLog = {
  warn: (payload: object, message: string) => void;
};

export type VaultSecrets = Record<string, string>;

type Reply = { auth?: Session; data?: { data?: Record<string, unknown> } };

type Request = { body?: object; method: 'GET' | 'POST'; path: string; token?: string };

type Session = { client_token: string; lease_duration: number; renewable: boolean };

type Transport = (url: string, init: RequestInit & { tls?: { ca: string } }) => Promise<Response>;

const DEFAULT_PATHS = 'time-manager/api,time-manager/shared';
const DEFAULT_TIMEOUT = 5000;
const MINIMUM_DELAY = 1000;
const RETRY_DELAY = 30_000;
const RENEW_RATIO = 2 / 3;

export class Vault {
  public static transport: Transport = (url, init) => fetch(url, init);
  private static ca: Promise<string | undefined> | undefined;
  private static log: undefined | VaultLog;
  private static timer: ReturnType<typeof setTimeout> | undefined;
  private static token: string | undefined;

  /**
   * @route vault.enabled
   * @returns {boolean}
   */
  public static enabled(): boolean {
    return Vault.setting('VAULT_ADDR') !== undefined;
  }

  /**
   * @route vault.load
   * @param {VaultLog} log
   * @returns {Promise<VaultSecrets>}
   * @throws {VaultLoginError | VaultReadError}
   */
  public static async load(log?: VaultLog): Promise<VaultSecrets> {
    if (!Vault.enabled()) return {};
    if (Vault.token === undefined) Vault.watch(await Vault.login(), log);
    const paths = (Vault.setting('VAULT_SECRET_PATHS') ?? DEFAULT_PATHS)
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '');
    const secrets: VaultSecrets = {};
    for (const path of paths) Object.assign(secrets, await Vault.read(path));

    return secrets;
  }

  /**
   * @route vault.login
   * @returns {Promise<number>}
   * @throws {VaultLoginError}
   */
  public static async login(): Promise<number> {
    try {
      const file = Vault.setting('VAULT_TOKEN_FILE');
      if (file !== undefined) {
        Vault.token = (await readFile(file, 'utf8')).trim();

        return 0;
      }
      const role = (await readFile(Vault.required('VAULT_ROLE_ID_FILE'), 'utf8')).trim();
      const secret = (await readFile(Vault.required('VAULT_SECRET_ID_FILE'), 'utf8')).trim();
      const mount = Vault.setting('VAULT_APPROLE_MOUNT') ?? 'approle';
      const reply = await Vault.request({
        body: { role_id: role, secret_id: secret },
        method: 'POST',
        path: `auth/${mount}/login`,
      });
      if (reply.auth === undefined) throw new Error('login reply has no auth block');
      Vault.token = reply.auth.client_token;

      return reply.auth.renewable ? reply.auth.lease_duration : 0;
    } catch (error) {
      Vault.token = undefined;
      throw VaultLoginError({ cause: error, metadata: { route: 'vault.login' } });
    }
  }

  /**
   * @route vault.read
   * @param {string} path
   * @returns {Promise<VaultSecrets>}
   * @throws {VaultReadError}
   */
  public static async read(path: string): Promise<VaultSecrets> {
    try {
      const mount = Vault.setting('VAULT_KV_MOUNT') ?? 'secret';
      const reply = await Vault.request({
        method: 'GET',
        path: `${mount}/data/${path.replace(/^\/+|\/+$/g, '')}`,
        token: Vault.token,
      });
      const data = reply.data?.data;
      if (data === undefined) throw new Error('secret has no data');
      const secrets: VaultSecrets = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') secrets[key] = value;
        else if (typeof value === 'number' || typeof value === 'boolean') secrets[key] = String(value);
      }

      return secrets;
    } catch (error) {
      throw VaultReadError({ cause: error, metadata: { path, route: 'vault.read' } });
    }
  }

  /**
   * @route vault.renew
   * @returns {Promise<number>}
   * @throws {VaultLoginError}
   */
  public static async renew(): Promise<number> {
    try {
      const reply = await Vault.request({
        method: 'POST',
        path: 'auth/token/renew-self',
        token: Vault.token,
      });
      if (reply.auth === undefined) throw new Error('renew reply has no auth block');

      return reply.auth.lease_duration;
    } catch (error) {
      Vault.log?.warn({ route: 'vault.renew', error: Vault.reason(error) }, 'vault token renewal failed');

      return Vault.login();
    }
  }

  /**
   * @route vault.stop
   * @returns {void}
   */
  public static stop(): void {
    if (Vault.timer !== undefined) clearTimeout(Vault.timer);
    Vault.timer = undefined;
    Vault.token = undefined;
    Vault.log = undefined;
    Vault.ca = undefined;
  }

  /**
   * @route vault.watch
   * @param {number} ttl
   * @param {VaultLog} log
   * @returns {void}
   */
  public static watch(ttl: number, log?: VaultLog): void {
    Vault.log = log;
    if (Vault.timer !== undefined) clearTimeout(Vault.timer);
    Vault.timer = undefined;
    if (ttl <= 0) return;
    const delay = Math.max(MINIMUM_DELAY, ttl * 1000 * RENEW_RATIO);
    Vault.timer = setTimeout(() => void Vault.cycle(), delay);
    Vault.timer.unref();
  }

  private static async cycle(): Promise<void> {
    try {
      Vault.watch(await Vault.renew(), Vault.log);
    } catch (error) {
      Vault.log?.warn({ route: 'vault.cycle', error: Vault.reason(error) }, 'vault login failed, retrying');
      if (Vault.timer !== undefined) clearTimeout(Vault.timer);
      Vault.timer = setTimeout(() => void Vault.cycle(), RETRY_DELAY);
      Vault.timer.unref();
    }
  }

  private static reason(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown';
  }

  private static async request(request: Request): Promise<Reply> {
    const address = Vault.required('VAULT_ADDR').replace(/\/+$/, '');
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (request.token !== undefined) headers['X-Vault-Token'] = request.token;
    const namespace = Vault.setting('VAULT_NAMESPACE');
    if (namespace !== undefined) headers['X-Vault-Namespace'] = namespace;
    if (request.body !== undefined) headers['Content-Type'] = 'application/json';
    const init: RequestInit & { tls?: { ca: string } } = {
      headers,
      method: request.method,
      signal: AbortSignal.timeout(Number(Vault.setting('VAULT_TIMEOUT_MS') ?? DEFAULT_TIMEOUT)),
    };
    if (request.body !== undefined) init.body = JSON.stringify(request.body);
    Vault.ca ??= Vault.trust();
    const ca = await Vault.ca;
    if (ca !== undefined) init.tls = { ca };
    const response = await Vault.transport(`${address}/v1/${request.path}`, init);
    if (!response.ok) throw new Error(`vault responded with status ${response.status}`);

    return (await response.json()) as Reply;
  }

  private static required(name: string): string {
    const value = Vault.setting(name);
    if (value === undefined) throw new Error(`${name} is required`);

    return value;
  }

  private static setting(name: string): string | undefined {
    const raw = process.env[name]?.trim();

    return raw === undefined || raw === '' ? undefined : raw;
  }

  private static async trust(): Promise<string | undefined> {
    const file = Vault.setting('VAULT_CACERT');

    return file === undefined ? undefined : readFile(file, 'utf8');
  }
}
