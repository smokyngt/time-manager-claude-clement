import { jwtVerify, SignJWT } from 'jose';

import { vaultConfig } from '@/config/vault/index.js';
import { TokenAuthenticationError } from '@/lib/errors/index.js';
import { ROLES } from '@/types/entities/index.js';
import { Time } from '@/utils/time.js';

import type { Actor, Role  } from '@/types/entities/index.js';

const ISSUER = 'time-manager';
const AUDIENCE = 'time-manager-web';

export type AccessToken = {
  expires_in: number;
  token: string;
};

export type RefreshToken = {
  expires_at: number;
  hash: string;
  token: string;
};

export class Tokens {
  /**
   * @route tokens.access
   * @param {{ id: string; role: Role }} user
   * @returns {Promise<AccessToken>}
   * @throws {ValidationError}
   */
  public static async access(user: { id: string; role: Role }): Promise<AccessToken> {
    const expiresIn = Tokens.accessTtl();
    const token = await new SignJWT({ role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${expiresIn}s`)
      .sign(Tokens.secret('JWT_ACCESS_SECRET'));

    return { expires_in: expiresIn, token };
  }

  /**
   * @route tokens.accessTtl
   * @returns {number}
   * @throws {ValidationError}
   */
  public static accessTtl(): number {
    return Time.seconds(vaultConfig.store.text('JWT_ACCESS_TTL', '15m'));
  }

  /**
   * @route tokens.hash
   * @param {string} token
   * @returns {string}
   */
  public static hash(token: string): string {
    const hasher = new Bun.CryptoHasher('sha256', Tokens.secretText('JWT_REFRESH_SECRET'));

    return hasher.update(token).digest('hex');
  }

  /**
   * @route tokens.refresh
   * @returns {RefreshToken}
   * @throws {ValidationError}
   */
  public static refresh(): RefreshToken {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Buffer.from(bytes).toString('base64url');

    return {
      expires_at: Date.now() + Tokens.refreshTtl() * 1000,
      hash: Tokens.hash(token),
      token,
    };
  }

  /**
   * @route tokens.refreshTtl
   * @returns {number}
   * @throws {ValidationError}
   */
  public static refreshTtl(): number {
    return Time.seconds(vaultConfig.store.text('JWT_REFRESH_TTL', '7d'));
  }

  /**
   * @route tokens.secret
   * @param {string} name
   * @returns {Uint8Array}
   */
  public static secret(name: string): Uint8Array {
    return new TextEncoder().encode(Tokens.secretText(name));
  }

  /**
   * @route tokens.secretText
   * @param {string} name
   * @returns {string}
   */
  public static secretText(name: string): string {
    return vaultConfig.store.text(name, `dev-only-${name.toLowerCase()}-change-me-in-production`);
  }

  /**
   * @route tokens.verify
   * @param {string} token
   * @returns {Promise<Actor>}
   * @throws {TokenAuthenticationError}
   */
  public static async verify(token: string): Promise<Actor> {
    try {
      const { payload } = await jwtVerify(token, Tokens.secret('JWT_ACCESS_SECRET'), {
        algorithms: ['HS256'],
        audience: AUDIENCE,
        issuer: ISSUER,
      });
      const role = ROLES.find((item) => item === payload['role']);
      if (payload.sub === undefined || role === undefined) {
        throw TokenAuthenticationError({ metadata: { route: 'tokens.verify' } });
      }

      return { id: payload.sub, role, team_ids: [] };
    } catch (error) {
      throw TokenAuthenticationError({ cause: error, metadata: { route: 'tokens.verify' } });
    }
  }
}
