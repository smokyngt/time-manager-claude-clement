import { and, desc, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';

import { encryptionKeys } from '@/db/schema/encryption-key.js';
import { Postgres } from '@/utils/postgres.js';

import { EncryptionKeyUnavailableError, KEY_DOMAINS, logInfo, transitKeyName } from './keys.js';
import { ensureTransitKey, wrapKey } from './transit.js';

import type { KeyDomain, Runtime } from './keys.js';
import type { EncryptionKeyRow } from '@/db/schema/encryption-key.js';

const DEK_BYTES = 32;
const locks = new Map<KeyDomain, Promise<EncryptionKeyRow>>();

const provision = async (runtime: Runtime, domain: KeyDomain): Promise<EncryptionKeyRow> => {
  const name = transitKeyName(domain);
  await ensureTransitKey(runtime.client, name);
  const existing = await runtime.db
    .select()
    .from(encryptionKeys)
    .where(and(eq(encryptionKeys.domain, domain), eq(encryptionKeys.status, 'active')))
    .orderBy(desc(encryptionKeys.version))
    .limit(1);
  if (existing[0] !== undefined) return existing[0];
  const wrapped = await wrapKey(runtime.client, name, randomBytes(DEK_BYTES));
  try {
    const inserted = await runtime.db
      .insert(encryptionKeys)
      .values({ domain, status: 'active', version: 1, wrapped_key: wrapped })
      .returning();
    const row = inserted[0];
    if (row === undefined) throw new Error('insert returned no row');
    logInfo(runtime, `bootstrapped domain=${domain} version=${row.version}`);

    return row;
  } catch (error) {
    if (!Postgres.conflict(error)) throw error;
    const winner = await runtime.db
      .select()
      .from(encryptionKeys)
      .where(and(eq(encryptionKeys.domain, domain), eq(encryptionKeys.version, 1)))
      .limit(1);
    if (winner[0] === undefined) throw error;
    logInfo(runtime, `bootstrap lost race domain=${domain} version=${winner[0].version}`);

    return winner[0];
  }
};

/**
 * @route services.encryption.envelope.bootstrap
 * @param {Runtime} runtime
 * @param {KeyDomain} domain
 * @returns {Promise<EncryptionKeyRow>}
 * @throws {EncryptionKeyUnavailableError}
 */
export const bootstrap = (runtime: Runtime, domain: KeyDomain): Promise<EncryptionKeyRow> => {
  const pending = locks.get(domain);
  if (pending !== undefined) return pending;
  const run = provision(runtime, domain)
    .catch((error: unknown) => {
      throw EncryptionKeyUnavailableError({
        cause: error,
        metadata: { domain, route: 'services.encryption.envelope.bootstrap' },
      });
    })
    .finally(() => {
      locks.delete(domain);
    });
  locks.set(domain, run);

  return run;
};

/**
 * @route services.encryption.envelope.bootstrap.all
 * @param {Runtime} runtime
 * @returns {Promise<EncryptionKeyRow[]>}
 * @throws {EncryptionKeyUnavailableError}
 */
export const bootstrapAll = (runtime: Runtime): Promise<EncryptionKeyRow[]> =>
  Promise.all(KEY_DOMAINS.map((domain) => bootstrap(runtime, domain)));
