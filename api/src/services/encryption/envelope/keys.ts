import { registerError } from '@/lib/errors/index.js';

import type { TransitClient } from './transit.js';
import type { Database } from '@/db/client.js';
import type { encryptionDomain } from '@/db/schema/index.js';

export type EnvelopeLog = {
  error: (message: string) => void;
  info: (message: string) => void;
};

export type KeyDomain = (typeof encryptionDomain.enumValues)[number];

export type Runtime = {
  client: TransitClient;
  db: Database;
  log?: EnvelopeLog;
};

export const KEY_DOMAINS: readonly KeyDomain[] = ['content', 'hash', 'pii'];

export const EncryptionDecryptFailedError = registerError({
  code: 'encryption.decrypt.failed',
  defaultStatus: 500,
});

export const EncryptionKeyUnavailableError = registerError({
  code: 'encryption.key.unavailable',
  defaultStatus: 503,
});

export const EncryptionRotationConflictError = registerError({
  code: 'encryption.rotation.conflict',
  defaultStatus: 409,
});

/**
 * @route services.encryption.envelope.keys.domain
 * @param {string} value
 * @returns {boolean}
 */
export const isKeyDomain = (value: string): value is KeyDomain =>
  (KEY_DOMAINS as readonly string[]).includes(value);

/**
 * @route services.encryption.envelope.keys.name
 * @param {KeyDomain} domain
 * @returns {string}
 */
export const transitKeyName = (domain: KeyDomain): string => `time-manager-${domain}-kek`;

/**
 * @route services.encryption.envelope.keys.info
 * @param {Runtime} runtime
 * @param {string} message
 * @returns {void}
 */
export const logInfo = (runtime: Runtime, message: string): void => {
  if (runtime.log !== undefined) runtime.log.info(`[ENVELOPE] ${message}`);
  else process.stdout.write(`[ENVELOPE] ${message}\n`);
};

/**
 * @route services.encryption.envelope.keys.error
 * @param {Runtime} runtime
 * @param {string} message
 * @returns {void}
 */
export const logError = (runtime: Runtime, message: string): void => {
  if (runtime.log !== undefined) runtime.log.error(`[ENVELOPE] ${message}`);
  else process.stderr.write(`[ENVELOPE] ${message}\n`);
};
