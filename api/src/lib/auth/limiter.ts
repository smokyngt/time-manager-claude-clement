import { Config } from '@/config/index.js';
import { Duration } from '@/utils/duration.js';

interface Entry {
  count: number;
  reset: number;
}

const CAPACITY = 10_000;

export class Limiter {
  private static readonly entries = new Map<string, Entry>();

  /**
   * @route limiter.blocked
   * @param {string} email
   * @returns {boolean}
   */
  public static blocked(email: string): boolean {
    const key = Limiter.key(email);
    const entry = Limiter.entries.get(key);
    if (entry === undefined) return false;
    if (entry.reset <= Date.now()) {
      Limiter.entries.delete(key);

      return false;
    }

    return entry.count >= Config.store.number('AUTH_ACCOUNT_RATE_LIMIT_MAX', 5);
  }

  /**
   * @route limiter.clear
   * @param {string} email
   * @returns {void}
   */
  public static clear(email: string): void {
    Limiter.entries.delete(Limiter.key(email));
  }

  /**
   * @route limiter.fail
   * @param {string} email
   * @returns {void}
   */
  public static fail(email: string): void {
    const key = Limiter.key(email);
    const now = Date.now();
    const entry = Limiter.entries.get(key);
    if (entry !== undefined && entry.reset > now) {
      entry.count += 1;

      return;
    }
    if (Limiter.entries.size >= CAPACITY) Limiter.prune(now);
    const window = Duration.seconds(Config.store.text('AUTH_ACCOUNT_RATE_LIMIT_WINDOW', '15m'), 900);
    Limiter.entries.set(key, { count: 1, reset: now + window * 1000 });
  }

  /**
   * @route limiter.key
   * @param {string} email
   * @returns {string}
   */
  public static key(email: string): string {
    return new Bun.CryptoHasher('sha256').update(email.trim().toLowerCase()).digest('hex');
  }

  /**
   * @route limiter.reset
   * @returns {void}
   */
  public static reset(): void {
    Limiter.entries.clear();
  }

  private static prune(now: number): void {
    for (const [key, entry] of Limiter.entries) {
      if (entry.reset <= now) Limiter.entries.delete(key);
    }
    if (Limiter.entries.size < CAPACITY) return;
    const oldest = Limiter.entries.keys().next();
    if (oldest.done !== true) Limiter.entries.delete(oldest.value);
  }
}
