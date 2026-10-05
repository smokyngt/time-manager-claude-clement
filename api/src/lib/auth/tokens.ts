import { jwtVerify, SignJWT } from 'jose';

import { Config } from '@/config/index.js';
import { ROLES } from '@/types/entities/user.js';
import { Duration } from '@/utils/duration.js';

import { UnauthorizedError } from '../errors/index.js';

import type { Actor } from '@/types/entities/actor.js';
import type { Role } from '@/types/entities/user.js';

const ISSUER = 'time-manager';
const AUDIENCE = 'time-manager-web';

export interface AccessToken {
  expires_in: number;
  token: string;
}

export interface RefreshToken {
  expires_at: number;
  hash: string;
  token: string;
}

export class Tokens {
  /**
   * @route tokens.access
   * @param {{ id: string; role: Role }} user
   * @returns {Promise<AccessToken>}
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
   */
  public static accessTtl(): number {
    return Duration.seconds(Config.store.text('JWT_ACCESS_TTL', '15m'), 900);
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
   */
  public static refreshTtl(): number {
    return Duration.seconds(Config.store.text('JWT_REFRESH_TTL', '7d'), 604_800);
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
    return Config.store.text(name, `dev-only-${name.toLowerCase()}-change-me-in-production`);
  }

  /**
   * @route tokens.verify
   * @param {string} token
   * @returns {Promise<Actor>}
   * @throws {UnauthorizedError}
   */
  public static async verify(token: string): Promise<Actor> {
    try {
      const { payload } = await jwtVerify(token, Tokens.secret('JWT_ACCESS_SECRET'), {
        algorithms: ['HS256'],
        audience: AUDIENCE,
        issuer: ISSUER,
      });
      const role = payload['role'] as Role | undefined;
      if (payload.sub === undefined || role === undefined || !ROLES.includes(role)) {
        throw UnauthorizedError({ metadata: { route: 'tokens.verify' } });
      }
      return { id: payload.sub, role, team_ids: [] };
    } catch (error) {
      throw UnauthorizedError({ cause: error, metadata: { route: 'tokens.verify' } });
    }
  }
}
