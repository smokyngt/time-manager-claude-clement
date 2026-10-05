import { createHmac, hkdfSync } from 'node:crypto';

import { Dek } from './dek.js';

import type { Runtime } from './keys.js';

const SUBKEY_BYTES = 32;

/**
 * @route services.encryption.envelope.digest.hash
 * @param {Runtime} runtime
 * @param {string} purpose
 * @param {string} value
 * @param {number} [version]
 * @returns {Promise<string>}
 * @throws {EncryptionKeyUnavailableError}
 */
export const hash = async (
  runtime: Runtime,
  purpose: string,
  value: string,
  version?: number,
): Promise<string> => {
  const { key } = await Dek.read(runtime, 'hash', version);
  const subkey = Buffer.from(
    hkdfSync('sha256', key, Buffer.alloc(0), `purpose:${purpose}`, SUBKEY_BYTES),
  );

  return createHmac('sha256', subkey).update(value, 'utf8').digest('hex');
};

/**
 * @route services.encryption.envelope.digest.email
 * @param {Runtime} runtime
 * @param {string} address
 * @returns {Promise<string>}
 * @throws {EncryptionKeyUnavailableError}
 */
export const email = (runtime: Runtime, address: string): Promise<string> =>
  hash(runtime, 'email', address.trim().toLowerCase());
