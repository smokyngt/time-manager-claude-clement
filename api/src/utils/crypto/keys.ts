import { createHash } from 'node:crypto';

import { Config } from '@/config/index.js';
import { CryptoKeyInvalidError } from '@/lib/errors/domains/crypto.js';
import { AppError } from '@/lib/errors/base/registry.js';

export type KeyEntry = { id: string; key: Buffer };

const DEV_LABEL = 'time-manager:dev-keys:v1';
const ENCRYPTION_BYTES = 32;
const HASH_MIN_BYTES = 32;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export class Keys {
  /**
   * @route keys.current
   * @returns {KeyEntry}
   */
  public static current(): KeyEntry {
    const id = Keys.identifier(Config.store.text('ENCRYPTION_KEY_ID', 'k1'), 'ENCRYPTION_KEY_ID');
    const raw = Config.store.optional('ENCRYPTION_KEY');
    if (raw === undefined) {
      if (Config.production()) throw Keys.invalid('ENCRYPTION_KEY is required');
      return { id, key: Keys.derive('encryption') };
    }
    const key = Keys.decode(raw, 'ENCRYPTION_KEY');
    if (key.length !== ENCRYPTION_BYTES)
      throw Keys.invalid(`ENCRYPTION_KEY must decode to exactly ${ENCRYPTION_BYTES} bytes`);
    return { id, key };
  }

  /**
   * @route keys.digest
   * @returns {Buffer}
   */
  public static digest(): Buffer {
    const raw = Config.store.optional('HASH_KEY');
    if (raw === undefined) {
      if (Config.production()) throw Keys.invalid('HASH_KEY is required');
      return Keys.derive('hash');
    }
    const key = Keys.decode(raw, 'HASH_KEY');
    if (key.length < HASH_MIN_BYTES)
      throw Keys.invalid(`HASH_KEY must decode to at least ${HASH_MIN_BYTES} bytes`);
    return key;
  }

  /**
   * @route keys.find
   * @param {string} id
   * @returns {Buffer | undefined}
   */
  public static find(id: string): Buffer | undefined {
    const current = Keys.current();
    if (current.id === id) return current.key;
    return Keys.previous().find((entry) => entry.id === id)?.key;
  }

  /**
   * @route keys.previous
   * @returns {KeyEntry[]}
   */
  public static previous(): KeyEntry[] {
    const raw = Config.store.optional('ENCRYPTION_KEYS_PREVIOUS');
    if (raw === undefined) return [];
    const currentId = Config.store.text('ENCRYPTION_KEY_ID', 'k1');
    const seen = new Set<string>([currentId]);
    const entries: KeyEntry[] = [];
    for (const item of raw.split(',')) {
      const part = item.trim();
      if (part === '') continue;
      const index = part.indexOf(':');
      if (index < 0) throw Keys.invalid('ENCRYPTION_KEYS_PREVIOUS entries must be id:base64');
      const id = Keys.identifier(part.slice(0, index), 'ENCRYPTION_KEYS_PREVIOUS');
      if (seen.has(id)) throw Keys.invalid(`ENCRYPTION_KEYS_PREVIOUS has a duplicate key id ${id}`);
      seen.add(id);
      const key = Keys.decode(part.slice(index + 1), 'ENCRYPTION_KEYS_PREVIOUS');
      if (key.length !== ENCRYPTION_BYTES)
        throw Keys.invalid(
          `ENCRYPTION_KEYS_PREVIOUS key ${id} must decode to exactly ${ENCRYPTION_BYTES} bytes`,
        );
      entries.push({ id, key });
    }
    return entries;
  }

  /**
   * @route keys.validate
   * @returns {string[]}
   */
  public static validate(): string[] {
    if (!Config.production()) return [];
    const problems: string[] = [];
    const checks: (() => unknown)[] = [
      (): unknown => Keys.current(),
      (): unknown => Keys.previous(),
      (): unknown => Keys.digest(),
    ];
    for (const check of checks) {
      try {
        check();
      } catch (error) {
        if (!AppError.is(error)) throw error;
        problems.push(String(error.metadata.reason));
      }
    }
    return problems;
  }

  private static decode(raw: string, name: string): Buffer {
    const value = raw.trim();
    if (value === '' || value.length % 4 !== 0 || !BASE64_PATTERN.test(value))
      throw Keys.invalid(`${name} must be valid base64`);
    return Buffer.from(value, 'base64');
  }

  private static derive(purpose: string): Buffer {
    return createHash('sha256').update(`${DEV_LABEL}:${purpose}`).digest();
  }

  private static identifier(value: string, name: string): string {
    if (!ID_PATTERN.test(value))
      throw Keys.invalid(`${name} key ids must match ${ID_PATTERN.source}`);
    return value;
  }

  private static invalid(reason: string): AppError {
    return CryptoKeyInvalidError({ metadata: { reason, route: 'keys.invalid' } });
  }
}
