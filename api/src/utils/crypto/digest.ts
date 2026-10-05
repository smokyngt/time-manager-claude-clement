import { createHmac } from 'node:crypto';

import { Keys } from './keys.js';

const DOMAIN = 'time-manager:digest:v1:';

export class Digest {
  /**
   * @route digest.email
   * @param {string} email
   * @returns {string}
   */
  public static email(email: string): string {
    return Digest.hash(email.trim().toLowerCase(), 'email');
  }

  /**
   * @route digest.hash
   * @param {string} value
   * @param {string} purpose
   * @returns {string}
   */
  public static hash(value: string, purpose: string): string {
    const subkey = createHmac('sha256', Keys.digest()).update(`${DOMAIN}${purpose}`).digest();
    return createHmac('sha256', subkey).update(value, 'utf8').digest('hex');
  }
}
