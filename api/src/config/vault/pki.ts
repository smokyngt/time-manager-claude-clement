import { Env } from '@/config/env.js';
import { VaultError } from '@/config/vault/url.js';

import type { VaultConfig } from '@/config/vault/index.js';

export type VaultCreds = { ca: string; cert: string; key: string };

export type VaultPkiListener = (creds: VaultCreds) => void;

type Issued = { creds: VaultCreds; expires: number };

const MAX_DELAY = 2_147_483_647;
const MINIMUM_DELAY = 1000;
const RETRY_DELAY = 60_000;

export class VaultPki {
  private readonly config: VaultConfig;
  private current: Issued | undefined;
  private readonly listeners = new Set<VaultPkiListener>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  public constructor(config: VaultConfig) {
    this.config = config;
  }

  /**
   * @route config.vault.pki.creds
   * @returns {VaultCreds}
   * @throws {VaultError}
   */
  public creds(): VaultCreds {
    if (this.current === undefined) throw new VaultError('PKI certificate has not been issued');

    return this.current.creds;
  }

  /**
   * @route config.vault.pki.enabled
   * @returns {boolean}
   */
  public enabled(): boolean {
    return Env.bool('VAULT_PKI_ENABLED', false);
  }

  /**
   * @route config.vault.pki.expires
   * @returns {number | undefined}
   */
  public expires(): number | undefined {
    return this.current?.expires;
  }

  /**
   * @route config.vault.pki.initialize
   * @returns {Promise<void>}
   * @throws {VaultError}
   */
  public async initialize(): Promise<void> {
    await this.issue();
    this.schedule();
  }

  /**
   * @route config.vault.pki.issue
   * @returns {Promise<VaultCreds>}
   * @throws {VaultError}
   */
  public async issue(): Promise<VaultCreds> {
    if (!this.enabled()) throw new VaultError('PKI is disabled: set VAULT_PKI_ENABLED=true');
    const mount = Env.str('VAULT_PKI_MOUNT', 'pki-internal');
    const role = Env.str('VAULT_PKI_ROLE', 'api-server');
    const path = `${mount}/issue/${role}`;
    const body: Record<string, string> = {
      alt_names: Env.list('VAULT_PKI_ALT_NAMES', ['api.internal', 'localhost']).join(','),
      common_name: Env.str('VAULT_PKI_COMMON_NAME', 'api'),
      ip_sans: Env.list('VAULT_PKI_IP_SANS', ['127.0.0.1']).join(','),
      ttl: Env.str('VAULT_PKI_TTL', '24h'),
    };
    const reply = await this.config.client.write(path, body);
    const data = reply.data;
    const certificate = data?.['certificate'];
    const key = data?.['private_key'];
    const issuer = data?.['issuing_ca'];
    if (typeof certificate !== 'string' || typeof key !== 'string' || typeof issuer !== 'string')
      throw new VaultError(`Vault PKI issue returned an incomplete certificate for ${path}`);
    const chain = data?.['ca_chain'];
    const ca = Array.isArray(chain) && chain.every((entry) => typeof entry === 'string')
      ? chain.join('\n')
      : issuer;
    const expiration = data?.['expiration'];
    const expires =
      typeof expiration === 'number' && expiration > 0
        ? expiration * 1000
        : Date.now() + (reply.lease_duration ?? 0) * 1000;
    if (expires <= Date.now())
      throw new VaultError(`Vault PKI issue returned no usable expiry for ${path}`);
    const creds: VaultCreds = { ca, cert: `${certificate}\n${issuer}`, key };
    this.current = { creds, expires };
    this.config.log.info(`[PKI] certificate issued from ${path}`);

    return creds;
  }

  /**
   * @route config.vault.pki.onRenew
   * @param {VaultPkiListener} listener
   * @returns {() => void}
   */
  public onRenew(listener: VaultPkiListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * @route config.vault.pki.schedule
   * @returns {void}
   */
  public schedule(): void {
    this.stop();
    if (this.current === undefined) return;
    const before = Env.int('VAULT_PKI_RENEW_BEFORE_MS', 3_600_000);
    const delay = Math.max(this.current.expires - Date.now() - before, MINIMUM_DELAY);
    this.arm(delay);
  }

  /**
   * @route config.vault.pki.stop
   * @returns {void}
   */
  public stop(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private arm(delay: number): void {
    this.timer = setTimeout(() => {
      void this.renew();
    }, Math.min(delay, MAX_DELAY));
    this.timer.unref();
  }

  private async renew(): Promise<void> {
    this.timer = undefined;
    try {
      const creds = await this.issue();
      for (const listener of this.listeners) {
        try {
          listener(creds);
        } catch {
          this.config.log.warn('[PKI] renew listener failed');
        }
      }
      this.schedule();
    } catch (error) {
      this.config.log.warn(
        `[PKI] renewal failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      this.arm(RETRY_DELAY);
    }
  }
}
