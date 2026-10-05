import { Env } from '@/config/env.js';
import { VaultError } from '@/config/vault/url.js';

export type VaultEnv = Record<string, string | undefined>;

export const SECRET_KEYS: readonly string[] = ['DATABASE_URL'];

export const SENSITIVE_KEYS: readonly string[] = [
  'ENCRYPTION_KEY',
  'ENCRYPTION_KEYS_PREVIOUS',
  'HASH_KEY',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'METRICS_TOKEN',
  'MICROSOFT_CLIENT_SECRET',
  'OAUTH_STATE_SECRET',
  'SEED_ADMIN_PASSWORD',
];

export class VaultStore {
  private readonly values = new Map<string, string>();

  /**
   * @route config.vault.store.boolean
   * @param {string} key
   * @param {boolean} fallback
   * @returns {boolean}
   * @throws {VaultError}
   */
  public boolean(key: string, fallback: boolean): boolean {
    const raw = this.optional(key)?.toLowerCase();
    if (raw === undefined) return fallback;
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;

    throw new VaultError(`Configuration ${key} must be a boolean`);
  }

  /**
   * @route config.vault.store.get
   * @param {string} key
   * @returns {string}
   * @throws {VaultError}
   */
  public get(key: string): string {
    const value = this.optional(key);
    if (value === undefined) throw new VaultError(`Configuration ${key} is not set`);

    return value;
  }

  /**
   * @route config.vault.store.has
   * @param {string} key
   * @returns {boolean}
   */
  public has(key: string): boolean {
    return this.optional(key) !== undefined;
  }

  /**
   * @route config.vault.store.list
   * @param {string} key
   * @param {string[]} fallback
   * @returns {string[]}
   */
  public list(key: string, fallback: string[] = []): string[] {
    const raw = this.optional(key);
    if (raw === undefined) return fallback;

    return raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '');
  }

  /**
   * @route config.vault.store.load
   * @param {VaultEnv} env
   * @returns {void}
   */
  public load(env: VaultEnv): void {
    const production = Env.str('NODE_ENV', 'development') === 'production';
    const entries = Object.entries(env).filter(
      ([key]) => !production || SECRET_KEYS.includes(key),
    );
    this.merge(Object.fromEntries(entries));
  }

  /**
   * @route config.vault.store.merge
   * @param {Record<string, unknown>} record
   * @returns {void}
   */
  public merge(record: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'string') {
        if (value !== '') this.values.set(key, value);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        this.values.set(key, String(value));
      }
    }
  }

  /**
   * @route config.vault.store.number
   * @param {string} key
   * @param {number} fallback
   * @returns {number}
   * @throws {VaultError}
   */
  public number(key: string, fallback: number): number {
    const raw = this.optional(key);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new VaultError(`Configuration ${key} must be a number`);

    return value;
  }

  /**
   * @route config.vault.store.optional
   * @param {string} key
   * @returns {string | undefined}
   */
  public optional(key: string): string | undefined {
    return this.values.get(key);
  }

  /**
   * @route config.vault.store.reset
   * @returns {void}
   */
  public reset(): void {
    this.values.clear();
  }

  /**
   * @route config.vault.store.text
   * @param {string} key
   * @param {string} fallback
   * @returns {string}
   */
  public text(key: string, fallback: string): string {
    return this.optional(key) ?? fallback;
  }
}
