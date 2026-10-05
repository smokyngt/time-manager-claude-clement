import type { VaultConfig } from '@/config/vault/index.js';

export type VaultCacheEntry = {
  data: Record<string, unknown>;
  expires: number;
  lease?: string;
  timer?: ReturnType<typeof setTimeout>;
};

const DEFAULT_TTL = 300_000;
const MAX_DELAY = 2_147_483_647;

export class VaultCache {
  private readonly config: VaultConfig;
  private readonly entries = new Map<string, VaultCacheEntry>();
  private readonly pending = new Map<string, Promise<Record<string, unknown>>>();

  public constructor(config: VaultConfig) {
    this.config = config;
  }

  /**
   * @route config.vault.cache.check
   * @returns {Promise<boolean>}
   */
  public async check(): Promise<boolean> {
    try {
      const health = await this.config.client.health({ standbyok: true });

      return health.initialized && !health.sealed;
    } catch {
      return false;
    }
  }

  /**
   * @route config.vault.cache.get
   * @param {string} path
   * @param {number} ttl
   * @returns {Promise<Record<string, unknown>>}
   * @throws {VaultError}
   */
  public async get(path: string, ttl: number = DEFAULT_TTL): Promise<Record<string, unknown>> {
    const entry = this.entries.get(path);
    if (entry !== undefined && entry.expires > Date.now()) return entry.data;
    const inflight = this.pending.get(path);
    if (inflight !== undefined) return inflight;

    return this.fetch(path, ttl);
  }

  /**
   * @route config.vault.cache.invalidate
   * @param {string} path
   * @returns {void}
   */
  public invalidate(path?: string): void {
    const paths = path === undefined ? [...this.entries.keys()] : [path];
    for (const key of paths) {
      const entry = this.entries.get(key);
      if (entry?.timer !== undefined) clearTimeout(entry.timer);
      this.entries.delete(key);
    }
  }

  /**
   * @route config.vault.cache.refresh
   * @param {string} path
   * @param {number} ttl
   * @returns {Promise<Record<string, unknown>>}
   * @throws {VaultError}
   */
  public async refresh(path: string, ttl: number = DEFAULT_TTL): Promise<Record<string, unknown>> {
    this.invalidate(path);

    return this.fetch(path, ttl);
  }

  private async fetch(path: string, ttl: number): Promise<Record<string, unknown>> {
    const request = this.load(path, ttl);
    this.pending.set(path, request);
    try {
      return await request;
    } finally {
      this.pending.delete(path);
    }
  }

  private async load(path: string, ttl: number): Promise<Record<string, unknown>> {
    const reply = await this.config.client.read(path);
    const entry: VaultCacheEntry = {
      data: reply.data ?? {},
      expires: Date.now() + ttl,
    };
    if (reply.lease_id !== undefined && reply.lease_id !== '') {
      entry.lease = reply.lease_id;
      if (reply.renewable === true && (reply.lease_duration ?? 0) > 0)
        this.watch(path, entry, reply.lease_duration ?? 0);
    }
    this.entries.set(path, entry);

    return entry.data;
  }

  private async renew(path: string, entry: VaultCacheEntry): Promise<void> {
    if (this.entries.get(path) !== entry || entry.lease === undefined) return;
    try {
      const reply = await this.config.client.leaseRenew(entry.lease);
      entry.expires = Math.max(entry.expires, Date.now() + (reply.lease_duration ?? 0) * 1000);
      this.config.log.info(`[VAULT] lease renewed for ${path}`);
      if ((reply.lease_duration ?? 0) > 0 && reply.renewable !== false)
        this.watch(path, entry, reply.lease_duration ?? 0);
    } catch (error) {
      this.config.log.warn(
        `[VAULT] lease renewal failed for ${path}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      this.invalidate(path);
    }
  }

  private watch(path: string, entry: VaultCacheEntry, duration: number): void {
    const delay = Math.min(Math.floor(duration * 1000 * this.config.threshold()), MAX_DELAY);
    entry.timer = setTimeout(() => {
      void this.renew(path, entry);
    }, delay);
    entry.timer.unref();
  }
}
