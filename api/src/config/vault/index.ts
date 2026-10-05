import { readFile } from 'node:fs/promises';

import { Env } from '@/config/env.js';
import { VaultCache } from '@/config/vault/manager.js';
import { VaultPki } from '@/config/vault/pki.js';
import { VaultStore } from '@/config/vault/store.js';
import { VaultToken } from '@/config/vault/token.js';
import { VaultError } from '@/config/vault/url.js';

export { VaultCache } from '@/config/vault/manager.js';
export type { VaultCreds } from '@/config/vault/pki.js';
export { VaultPki } from '@/config/vault/pki.js';
export { SECRET_KEYS, SENSITIVE_KEYS, VaultStore } from '@/config/vault/store.js';
export { VaultToken } from '@/config/vault/token.js';
export { VaultError, VaultUrl } from '@/config/vault/url.js';

export type VaultDocument = { data: Record<string, unknown>; version: number };

export type VaultHealth = { initialized: boolean; sealed: boolean; standby: boolean };

export type VaultLog = { info: (message: string) => void; warn: (message: string) => void };

export type VaultReply = {
  auth?: { client_token?: string; lease_duration?: number; renewable?: boolean };
  data?: Record<string, unknown>;
  lease_duration?: number;
  lease_id?: string;
  renewable?: boolean;
};

export type VaultSettings = { token?: string; url: string };

export type VaultWrite = { cas?: number; data: Record<string, unknown>; path: string };

type Request = {
  accept?: number[];
  body?: object;
  method: 'GET' | 'POST' | 'PUT';
  operation: string;
  path: string;
  query?: string;
};

const DEFAULT_THRESHOLD = 0.8;
const DEFAULT_TIMEOUT = 5000;
const HEALTH_CODES = [200, 429, 472, 473, 501, 503];

export class VaultClient {
  private ca: Promise<string | undefined> | undefined;
  private settings: undefined | VaultSettings;

  /**
   * @route config.vault.client.configure
   * @param {VaultSettings} settings
   * @returns {void}
   */
  public configure(settings: VaultSettings): void {
    this.settings = settings;
    this.ca = undefined;
  }

  /**
   * @route config.vault.client.health
   * @param {{ standbyok: boolean }} options
   * @returns {Promise<VaultHealth>}
   * @throws {VaultError}
   */
  public async health(options: { standbyok: boolean } = { standbyok: true }): Promise<VaultHealth> {
    const reply = await this.request({
      accept: HEALTH_CODES,
      method: 'GET',
      operation: 'health',
      path: 'sys/health',
      query: options.standbyok ? 'standbyok=true&perfstandbyok=true' : '',
    });
    const initialized = (reply as Record<string, unknown>)['initialized'];
    const sealed = (reply as Record<string, unknown>)['sealed'];
    const standby = (reply as Record<string, unknown>)['standby'];
    if (typeof initialized !== 'boolean' || typeof sealed !== 'boolean')
      throw new VaultError('Vault health failed for sys/health: unexpected reply');

    return { initialized, sealed, standby: standby === true };
  }

  /**
   * @route config.vault.client.leaseRenew
   * @param {string} leaseId
   * @param {number} increment
   * @returns {Promise<VaultReply>}
   * @throws {VaultError}
   */
  public async leaseRenew(leaseId: string, increment?: number): Promise<VaultReply> {
    return this.request({
      body: increment === undefined ? { lease_id: leaseId } : { increment, lease_id: leaseId },
      method: 'PUT',
      operation: 'lease renew',
      path: 'sys/leases/renew',
    });
  }

  /**
   * @route config.vault.client.list
   * @param {string} path
   * @returns {Promise<string[]>}
   * @throws {VaultError}
   */
  public async list(path: string): Promise<string[]> {
    const reply = await this.request({
      method: 'GET',
      operation: 'list',
      path,
      query: 'list=true',
    });
    const keys = reply.data?.['keys'];

    return Array.isArray(keys) ? keys.filter((key): key is string => typeof key === 'string') : [];
  }

  /**
   * @route config.vault.client.lookupSelf
   * @returns {Promise<VaultReply>}
   * @throws {VaultError}
   */
  public async lookupSelf(): Promise<VaultReply> {
    return this.request({
      method: 'GET',
      operation: 'token lookup',
      path: 'auth/token/lookup-self',
    });
  }

  /**
   * @route config.vault.client.read
   * @param {string} path
   * @returns {Promise<VaultReply>}
   * @throws {VaultError}
   */
  public async read(path: string): Promise<VaultReply> {
    return this.request({ method: 'GET', operation: 'read secret', path });
  }

  /**
   * @route config.vault.client.tokenRenewSelf
   * @param {number} increment
   * @returns {Promise<VaultReply>}
   * @throws {VaultError}
   */
  public async tokenRenewSelf(increment?: number): Promise<VaultReply> {
    return this.request({
      body: increment === undefined ? {} : { increment },
      method: 'POST',
      operation: 'token renew',
      path: 'auth/token/renew-self',
    });
  }

  /**
   * @route config.vault.client.write
   * @param {string} path
   * @param {object} body
   * @returns {Promise<VaultReply>}
   * @throws {VaultError}
   */
  public async write(path: string, body: object): Promise<VaultReply> {
    return this.request({ body, method: 'POST', operation: 'write secret', path });
  }

  private async authority(): Promise<string | undefined> {
    const file = Env.opt('VAULT_CACERT');
    if (file === undefined) return undefined;
    this.ca ??= readFile(file, 'utf8');

    return this.ca;
  }

  private async request(request: Request): Promise<VaultReply> {
    if (this.settings === undefined) throw new VaultError('Vault client is not configured');
    const path = request.path.replace(/^\/+/, '');
    const suffix = request.query === undefined || request.query === '' ? '' : `?${request.query}`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.settings.token !== undefined) headers['X-Vault-Token'] = this.settings.token;
    if (request.body !== undefined) headers['Content-Type'] = 'application/json';
    let response: Response;
    try {
      const ca = await this.authority();
      const init: { tls?: { ca: string } } & RequestInit = {
        headers,
        method: request.method,
        signal: AbortSignal.timeout(Env.int('VAULT_TIMEOUT_MS', DEFAULT_TIMEOUT)),
      };
      if (request.body !== undefined) init.body = JSON.stringify(request.body);
      if (ca !== undefined) init.tls = { ca };
      response = await fetch(`${this.settings.url}/v1/${path}${suffix}`, init);
    } catch (error) {
      throw new VaultError(`Vault ${request.operation} failed for ${path}`, { cause: error });
    }
    const accepted = request.accept ?? [];
    if (!response.ok && !accepted.includes(response.status))
      throw new VaultError(
        `Vault ${request.operation} failed for ${path} (HTTP ${response.status})`,
        { status: response.status },
      );
    const text = await response.text();
    if (text === '') return {};
    try {
      return JSON.parse(text) as VaultReply;
    } catch (error) {
      throw new VaultError(`Vault ${request.operation} failed for ${path}: invalid reply`, {
        cause: error,
        status: response.status,
      });
    }
  }
}

export class VaultConfig {
  public readonly cache: VaultCache;
  public readonly client: VaultClient;
  public log: VaultLog = {
    info: (message) => process.stdout.write(`${message}\n`),
    warn: (message) => process.stderr.write(`${message}\n`),
  };
  public readonly pki: VaultPki;
  public readonly store: VaultStore;
  public readonly token: VaultToken;

  /**
   * @route config.vault.disabled
   * @returns {boolean}
   */
  public get disabled(): boolean {
    return Env.opt('VAULT_URL') === undefined && Env.str('NODE_ENV', 'development') !== 'production';
  }

  public constructor() {
    this.client = new VaultClient();
    this.store = new VaultStore();
    this.token = new VaultToken(this);
    this.pki = new VaultPki(this);
    this.cache = new VaultCache(this);
  }

  /**
   * @route config.vault.read
   * @param {string} path
   * @returns {Promise<VaultDocument>}
   * @throws {VaultError}
   */
  public async read(path: string): Promise<VaultDocument> {
    const reply = await this.client.read(path);
    const document = reply.data?.['data'];
    if (typeof document !== 'object' || document === null || Array.isArray(document))
      throw new VaultError(`Vault read secret failed for ${path}: not a KV v2 document`);
    const metadata = reply.data?.['metadata'] as { version?: number } | undefined;

    return { data: document as Record<string, unknown>, version: metadata?.version ?? 0 };
  }

  /**
   * @route config.vault.stop
   * @returns {void}
   */
  public stop(): void {
    this.token.stop();
    this.pki.stop();
    this.cache.invalidate();
  }

  /**
   * @route config.vault.threshold
   * @returns {number}
   */
  public threshold(): number {
    const raw = Number(Env.str('VAULT_RENEWAL_THRESHOLD', String(DEFAULT_THRESHOLD)));

    return raw > 0 && raw < 1 ? raw : DEFAULT_THRESHOLD;
  }

  /**
   * @route config.vault.write
   * @param {VaultWrite} params
   * @returns {Promise<void>}
   * @throws {VaultError}
   */
  public async write(params: VaultWrite): Promise<void> {
    const body: Record<string, unknown> = { data: params.data };
    if (params.cas !== undefined) body['options'] = { cas: params.cas };
    await this.client.write(params.path, body);
  }
}

export const vaultConfig = new VaultConfig();
