import { and, desc, eq, ne } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';

import { encryptionKeys } from '@/db/schema/index.js';
import { Postgres } from '@/utils/postgres.js';

import { Dek } from './dek.js';
import {
  EncryptionKeyUnavailableError,
  EncryptionRotationConflictError,
  logError,
  logInfo,
  transitKeyName,
} from './keys.js';
import { rewrapKey, rotateTransitKey, wrapKey } from './transit.js';

import type { KeyDomain, Runtime } from './keys.js';

export type RewrapResult = { failed: number[]; rewrapped: number[] };

const DEK_BYTES = 32;

/**
 * @route services.encryption.envelope.rotate.dek
 * @param {Runtime} runtime
 * @param {KeyDomain} domain
 * @returns {Promise<number>}
 * @throws {EncryptionKeyUnavailableError | EncryptionRotationConflictError}
 */
export const rotateDEK = async (runtime: Runtime, domain: KeyDomain): Promise<number> => {
  try {
    const wrapped = await wrapKey(runtime.client, transitKeyName(domain), randomBytes(DEK_BYTES));
    const version = await runtime.db.transaction(async (tx) => {
      const latest = await tx
        .select()
        .from(encryptionKeys)
        .where(eq(encryptionKeys.domain, domain))
        .orderBy(desc(encryptionKeys.version))
        .limit(1);
      const next = (latest[0]?.version ?? 0) + 1;
      await tx
        .insert(encryptionKeys)
        .values({ domain, status: 'active', version: next, wrapped_key: wrapped });
      await tx
        .update(encryptionKeys)
        .set({ status: 'decrypt-only' })
        .where(and(eq(encryptionKeys.domain, domain), ne(encryptionKeys.version, next)));

      return next;
    });
    Dek.clear(domain);
    logInfo(runtime, `rotated dek domain=${domain} version=${version}`);

    return version;
  } catch (error) {
    if (Postgres.conflict(error)) {
      throw EncryptionRotationConflictError({
        cause: error,
        message: 'Concurrent rotation detected',
        metadata: { domain, route: 'services.encryption.envelope.rotate.dek' },
      });
    }
    throw EncryptionKeyUnavailableError({
      cause: error,
      metadata: { domain, route: 'services.encryption.envelope.rotate.dek' },
    });
  }
};

/**
 * @route services.encryption.envelope.rotate.kek
 * @param {Runtime} runtime
 * @param {KeyDomain} domain
 * @returns {Promise<RewrapResult>}
 * @throws {EncryptionKeyUnavailableError}
 */
export const rotateTransitKEK = async (
  runtime: Runtime,
  domain: KeyDomain,
): Promise<RewrapResult> => {
  const name = transitKeyName(domain);
  const result: RewrapResult = { failed: [], rewrapped: [] };
  try {
    await rotateTransitKey(runtime.client, name);
    const rows = await runtime.db
      .select()
      .from(encryptionKeys)
      .where(eq(encryptionKeys.domain, domain))
      .orderBy(encryptionKeys.version);
    logInfo(runtime, `rotated kek domain=${domain} versions=${rows.length}`);
    for (const row of rows) {
      try {
        const wrapped = await rewrapKey(runtime.client, name, row.wrapped_key);
        await runtime.db
          .update(encryptionKeys)
          .set({ wrapped_key: wrapped })
          .where(eq(encryptionKeys.id, row.id));
        result.rewrapped.push(row.version);
      } catch {
        result.failed.push(row.version);
        logError(runtime, `rewrap failed domain=${domain} version=${row.version}`);
      }
    }
    Dek.clear(domain);

    return result;
  } catch (error) {
    throw EncryptionKeyUnavailableError({
      cause: error,
      metadata: { domain, route: 'services.encryption.envelope.rotate.kek' },
    });
  }
};
