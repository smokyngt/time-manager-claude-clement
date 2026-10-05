import { vaultConfig } from '@/config/vault/index.js';
import { db } from '@/db/client.js';

import { bootstrap, bootstrapAll } from './bootstrap.js';
import { open, openNullable, seal, sealNullable } from './cipher.js';
import { Dek } from './dek.js';
import { email, hash } from './digest.js';
import { rotateDEK, rotateTransitKEK } from './rotate.js';

import type { KeyDomain, Runtime } from './keys.js';
import type { RewrapResult } from './rotate.js';

export { bootstrap, bootstrapAll } from './bootstrap.js';
export { Dek } from './dek.js';
export type { DekEntry } from './dek.js';
export {
  EncryptionDecryptFailedError,
  EncryptionKeyUnavailableError,
  EncryptionRotationConflictError,
  KEY_DOMAINS,
  transitKeyName,
} from './keys.js';
export type { EnvelopeLog, KeyDomain, Runtime } from './keys.js';
export { rotateDEK, rotateTransitKEK } from './rotate.js';
export type { RewrapResult } from './rotate.js';
export { ensureTransitKey } from './transit.js';
export type { TransitClient, TransitReply } from './transit.js';

class NullableEnvelope {
  /**
   * @route services.encryption.envelope.nullable.open
   * @param {null | string} sealed
   * @returns {Promise<null | string>}
   * @throws {EncryptionDecryptFailedError | EncryptionKeyUnavailableError}
   */
  public open(sealed: null | string): Promise<null | string> {
    return openNullable(Envelope.runtime(), sealed);
  }

  /**
   * @route services.encryption.envelope.nullable.seal
   * @param {KeyDomain} domain
   * @param {null | string} plaintext
   * @returns {Promise<null | string>}
   * @throws {EncryptionKeyUnavailableError}
   */
  public seal(domain: KeyDomain, plaintext: null | string): Promise<null | string> {
    return sealNullable(Envelope.runtime(), domain, plaintext);
  }
}

export class Envelope {
  public static readonly nullable = new NullableEnvelope();
  private static bound: Runtime = { client: vaultConfig.client, db };

  /**
   * @route services.encryption.envelope.bootstrap
   * @param {KeyDomain} [domain]
   * @returns {Promise<void>}
   * @throws {EncryptionKeyUnavailableError}
   */
  public static async bootstrap(domain?: KeyDomain): Promise<void> {
    if (domain === undefined) await bootstrapAll(Envelope.runtime());
    else await bootstrap(Envelope.runtime(), domain);
  }

  /**
   * @route services.encryption.envelope.email
   * @param {string} address
   * @returns {Promise<string>}
   * @throws {EncryptionKeyUnavailableError}
   */
  public static email(address: string): Promise<string> {
    return email(Envelope.runtime(), address);
  }

  /**
   * @route services.encryption.envelope.hash
   * @param {string} purpose
   * @param {string} value
   * @returns {Promise<string>}
   * @throws {EncryptionKeyUnavailableError}
   */
  public static hash(purpose: string, value: string): Promise<string> {
    return hash(Envelope.runtime(), purpose, value);
  }

  /**
   * @route services.encryption.envelope.open
   * @param {string} sealed
   * @returns {Promise<string>}
   * @throws {EncryptionDecryptFailedError | EncryptionKeyUnavailableError}
   */
  public static open(sealed: string): Promise<string> {
    return open(Envelope.runtime(), sealed);
  }

  /**
   * @route services.encryption.envelope.reset
   * @returns {void}
   */
  public static reset(): void {
    Envelope.bound = { client: vaultConfig.client, db };
    Dek.clear();
  }

  /**
   * @route services.encryption.envelope.rewrap
   * @param {KeyDomain} domain
   * @returns {Promise<RewrapResult>}
   * @throws {EncryptionKeyUnavailableError}
   */
  public static rewrap(domain: KeyDomain): Promise<RewrapResult> {
    return rotateTransitKEK(Envelope.runtime(), domain);
  }

  /**
   * @route services.encryption.envelope.rotate
   * @param {KeyDomain} domain
   * @returns {Promise<number>}
   * @throws {EncryptionKeyUnavailableError | EncryptionRotationConflictError}
   */
  public static rotate(domain: KeyDomain): Promise<number> {
    return rotateDEK(Envelope.runtime(), domain);
  }

  /**
   * @route services.encryption.envelope.runtime
   * @returns {Runtime}
   */
  public static runtime(): Runtime {
    return Envelope.bound;
  }

  /**
   * @route services.encryption.envelope.seal
   * @param {KeyDomain} domain
   * @param {string} plaintext
   * @returns {Promise<string>}
   * @throws {EncryptionKeyUnavailableError}
   */
  public static seal(domain: KeyDomain, plaintext: string): Promise<string> {
    return seal(Envelope.runtime(), domain, plaintext);
  }

  /**
   * @route services.encryption.envelope.use
   * @param {Runtime} runtime
   * @returns {void}
   */
  public static use(runtime: Runtime): void {
    Envelope.bound = runtime;
  }
}
