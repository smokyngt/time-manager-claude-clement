import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { CryptoDecryptFailedError } from '@/lib/errors/index.js';

import { Keys } from './keys.js';

const AAD = Buffer.from('time-manager:v1', 'utf8');
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = 'v1';

class NullableCipher {
  /**
   * @route cipher.nullable.open
   * @param {null | string} sealed
   * @returns {null | string}
   */
  public open(sealed: null | string): null | string {
    return sealed === null ? null : Cipher.open(sealed);
  }

  /**
   * @route cipher.nullable.rotate
   * @param {null | string} sealed
   * @returns {null | string}
   */
  public rotate(sealed: null | string): null | string {
    return sealed === null ? null : Cipher.rotate(sealed);
  }

  /**
   * @route cipher.nullable.seal
   * @param {null | string} plain
   * @returns {null | string}
   */
  public seal(plain: null | string): null | string {
    return plain === null ? null : Cipher.seal(plain);
  }
}

export class Cipher {
  public static readonly nullable = new NullableCipher();

  /**
   * @route cipher.current
   * @param {string} sealed
   * @returns {boolean}
   */
  public static current(sealed: string): boolean {
    const parts = sealed.split('.');
    return parts.length === 5 && parts[0] === VERSION && parts[1] === Keys.current().id;
  }

  /**
   * @route cipher.open
   * @param {string} sealed
   * @returns {string}
   * @throws {CryptoDecryptFailedError}
   */
  public static open(sealed: string): string {
    try {
      const parts = sealed.split('.');
      const [version, id, iv, tag, data] = parts;
      if (
        parts.length !== 5 ||
        version !== VERSION ||
        id === undefined ||
        iv === undefined ||
        tag === undefined ||
        data === undefined
      )
        throw new Error('malformed sealed value');
      const key = Keys.find(id);
      if (key === undefined) throw new Error('unknown key id');
      const ivBytes = Buffer.from(iv, 'base64url');
      const tagBytes = Buffer.from(tag, 'base64url');
      if (ivBytes.length !== IV_BYTES || tagBytes.length !== TAG_BYTES)
        throw new Error('malformed sealed value');
      const decipher = createDecipheriv(ALGORITHM, key, ivBytes, { authTagLength: TAG_BYTES });
      decipher.setAAD(AAD);
      decipher.setAuthTag(tagBytes);
      return Buffer.concat([
        decipher.update(Buffer.from(data, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch (error) {
      throw CryptoDecryptFailedError({ cause: error, metadata: { route: 'cipher.open' } });
    }
  }

  /**
   * @route cipher.rotate
   * @param {string} sealed
   * @returns {string}
   */
  public static rotate(sealed: string): string {
    return Cipher.current(sealed) ? sealed : Cipher.seal(Cipher.open(sealed));
  }

  /**
   * @route cipher.seal
   * @param {string} plain
   * @returns {string}
   */
  public static seal(plain: string): string {
    const { id, key } = Keys.current();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    cipher.setAAD(AAD);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [
      VERSION,
      id,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      data.toString('base64url'),
    ].join('.');
  }
}
