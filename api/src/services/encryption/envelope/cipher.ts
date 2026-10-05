import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Dek } from './dek.js';
import { EncryptionDecryptFailedError, isKeyDomain } from './keys.js';

import type { KeyDomain, Runtime } from './keys.js';

type Parsed = { data: Buffer; domain: KeyDomain; iv: Buffer; tag: Buffer; version: number };

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const PARTS = 6;
const TAG_BYTES = 16;
const VERSION = 'v1';

const aad = (domain: KeyDomain): Buffer => Buffer.from(`time-manager:${domain}:${VERSION}`, 'utf8');

const failed = (cause?: unknown): Error =>
  EncryptionDecryptFailedError({
    cause,
    metadata: { route: 'services.encryption.envelope.cipher.open' },
  });

const parse = (sealed: string): Parsed => {
  const parts = sealed.split('.');
  const [format, domain, version, iv, tag, data] = parts;
  if (
    parts.length !== PARTS ||
    format !== VERSION ||
    domain === undefined ||
    !isKeyDomain(domain) ||
    version === undefined ||
    !/^[1-9]\d{0,8}$/.test(version) ||
    iv === undefined ||
    tag === undefined ||
    data === undefined
  )
    throw failed();
  const ivBytes = Buffer.from(iv, 'base64url');
  const tagBytes = Buffer.from(tag, 'base64url');
  if (ivBytes.length !== IV_BYTES || tagBytes.length !== TAG_BYTES) throw failed();

  return {
    data: Buffer.from(data, 'base64url'),
    domain,
    iv: ivBytes,
    tag: tagBytes,
    version: Number(version),
  };
};

/**
 * @route services.encryption.envelope.cipher.seal
 * @param {Runtime} runtime
 * @param {KeyDomain} domain
 * @param {string} plaintext
 * @returns {Promise<string>}
 * @throws {EncryptionKeyUnavailableError}
 */
export const seal = async (
  runtime: Runtime,
  domain: KeyDomain,
  plaintext: string,
): Promise<string> => {
  const { key, version } = await Dek.read(runtime, domain);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(aad(domain));
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return [
    VERSION,
    domain,
    String(version),
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    data.toString('base64url'),
  ].join('.');
};

/**
 * @route services.encryption.envelope.cipher.open
 * @param {Runtime} runtime
 * @param {string} sealed
 * @returns {Promise<string>}
 * @throws {EncryptionDecryptFailedError | EncryptionKeyUnavailableError}
 */
export const open = async (runtime: Runtime, sealed: string): Promise<string> => {
  const parsed = parse(sealed);
  const { key } = await Dek.read(runtime, parsed.domain, parsed.version);
  try {
    const decipher = createDecipheriv(ALGORITHM, key, parsed.iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(aad(parsed.domain));
    decipher.setAuthTag(parsed.tag);

    return Buffer.concat([decipher.update(parsed.data), decipher.final()]).toString('utf8');
  } catch (error) {
    throw failed(error);
  }
};

/**
 * @route services.encryption.envelope.cipher.sealNullable
 * @param {Runtime} runtime
 * @param {KeyDomain} domain
 * @param {null | string} plaintext
 * @returns {Promise<null | string>}
 * @throws {EncryptionKeyUnavailableError}
 */
export const sealNullable = async (
  runtime: Runtime,
  domain: KeyDomain,
  plaintext: null | string,
): Promise<null | string> => (plaintext === null ? null : seal(runtime, domain, plaintext));

/**
 * @route services.encryption.envelope.cipher.openNullable
 * @param {Runtime} runtime
 * @param {null | string} sealed
 * @returns {Promise<null | string>}
 * @throws {EncryptionDecryptFailedError | EncryptionKeyUnavailableError}
 */
export const openNullable = async (
  runtime: Runtime,
  sealed: null | string,
): Promise<null | string> => (sealed === null ? null : open(runtime, sealed));
