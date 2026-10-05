import { and, desc, eq } from 'drizzle-orm';

import { encryptionKeys } from '@/db/schema/index.js';
import { AppError } from '@/lib/errors/index.js';

import { EncryptionKeyUnavailableError, transitKeyName } from './keys.js';
import { unwrapKey } from './transit.js';

import type { KeyDomain, Runtime } from './keys.js';
import type { EncryptionKeyRow } from '@/db/schema/index.js';

export type DekEntry = { key: Buffer; version: number };

type Cached<Value> = { expires: number; promise: Promise<Value> };

const ACTIVE_TTL_MS = 30_000;
const DEK_BYTES = 32;
const KEY_TTL_MS = 5 * 60_000;

export class Dek {
  private static readonly active = new Map<string, Cached<number>>();
  private static readonly keys = new Map<string, Cached<Buffer>>();

  /**
   * @route services.encryption.envelope.dek.clear
   * @param {KeyDomain} domain
   * @returns {void}
   */
  public static clear(domain?: KeyDomain): void {
    if (domain === undefined) {
      Dek.active.clear();
      Dek.keys.clear();

      return;
    }
    Dek.active.delete(domain);
    for (const key of Dek.keys.keys()) if (key.startsWith(`${domain}:`)) Dek.keys.delete(key);
  }

  /**
   * @route services.encryption.envelope.dek.latest
   * @param {Runtime} runtime
   * @param {KeyDomain} domain
   * @returns {Promise<number>}
   * @throws {EncryptionKeyUnavailableError}
   */
  public static latest(runtime: Runtime, domain: KeyDomain): Promise<number> {
    const hit = Dek.active.get(domain);
    if (hit !== undefined && hit.expires > Date.now()) return hit.promise;
    const entry: Cached<number> = {
      expires: Date.now() + ACTIVE_TTL_MS,
      promise: Dek.lookup(runtime, domain),
    };
    Dek.active.set(domain, entry);
    entry.promise.catch(() => {
      if (Dek.active.get(domain) === entry) Dek.active.delete(domain);
    });

    return entry.promise;
  }

  /**
   * @route services.encryption.envelope.dek.read
   * @param {Runtime} runtime
   * @param {KeyDomain} domain
   * @param {number} [version]
   * @returns {Promise<DekEntry>}
   * @throws {EncryptionKeyUnavailableError}
   */
  public static async read(
    runtime: Runtime,
    domain: KeyDomain,
    version?: number,
  ): Promise<DekEntry> {
    const resolved = version ?? (await Dek.latest(runtime, domain));
    const id = `${domain}:${resolved}`;
    const hit = Dek.keys.get(id);
    if (hit !== undefined && hit.expires > Date.now()) {
      return { key: await hit.promise, version: resolved };
    }
    const entry: Cached<Buffer> = {
      expires: Date.now() + KEY_TTL_MS,
      promise: Dek.unwrap(runtime, domain, resolved),
    };
    Dek.keys.set(id, entry);
    entry.promise.catch(() => {
      if (Dek.keys.get(id) === entry) Dek.keys.delete(id);
    });

    return { key: await entry.promise, version: resolved };
  }

  private static async lookup(runtime: Runtime, domain: KeyDomain): Promise<number> {
    try {
      const rows = await runtime.db
        .select()
        .from(encryptionKeys)
        .where(and(eq(encryptionKeys.domain, domain), eq(encryptionKeys.status, 'active')))
        .orderBy(desc(encryptionKeys.version))
        .limit(1);
      const row = rows[0];
      if (row === undefined) throw new Error('no active key');

      return row.version;
    } catch (error) {
      throw Dek.unavailable(error, domain, 'dek.latest');
    }
  }

  private static unavailable(error: unknown, domain: KeyDomain, route: string): AppError {
    return EncryptionKeyUnavailableError({
      cause: error,
      metadata: { domain, route: `services.encryption.envelope.${route}` },
    });
  }

  private static async unwrap(
    runtime: Runtime,
    domain: KeyDomain,
    version: number,
  ): Promise<Buffer> {
    try {
      const rows: EncryptionKeyRow[] = await runtime.db
        .select()
        .from(encryptionKeys)
        .where(and(eq(encryptionKeys.domain, domain), eq(encryptionKeys.version, version)))
        .limit(1);
      const row = rows[0];
      if (row === undefined) throw new Error('key version not found');
      const key = await unwrapKey(runtime.client, transitKeyName(domain), row.wrapped_key);
      if (key.length !== DEK_BYTES) throw new Error('unexpected key length');

      return key;
    } catch (error) {
      throw Dek.unavailable(error, domain, 'dek.read');
    }
  }
}
