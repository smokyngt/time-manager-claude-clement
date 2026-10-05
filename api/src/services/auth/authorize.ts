import { SignJWT } from 'jose';

import { Microsoft } from '@/lib/auth/microsoft.js';
import { Tokens } from '@/lib/auth/tokens.js';
import { AuthMicrosoftError, AuthMicrosoftUnavailableError } from '@/lib/errors/domains/auth.js';

import type { AuthorizeParams, AuthorizeResponse } from './index.js';

const STATE_TTL = 600;

/**
 * @route auth.service.authorize
 * @param {AuthorizeParams} _params
 * @returns {Promise<AuthorizeResponse>}
 * @throws {AuthMicrosoftError}
 */
export const authorize = async (_params: AuthorizeParams): Promise<AuthorizeResponse> => {
  try {
    if (Microsoft.config() === undefined) {
      throw AuthMicrosoftUnavailableError({ metadata: { route: 'auth.service.authorize' } });
    }
    const state = Microsoft.random(24);
    const nonce = Microsoft.random(24);
    const verifier = Microsoft.random(48);
    const url = Microsoft.authorizeUrl({ challenge: Microsoft.challenge(verifier), nonce, state });
    if (url === undefined) {
      throw AuthMicrosoftUnavailableError({ metadata: { route: 'auth.service.authorize' } });
    }
    const stateCookie = await new SignJWT({ nonce, state, verifier })
      .setProtectedHeader({ alg: 'HS256' })
      .setAudience('oauth-state')
      .setExpirationTime(`${STATE_TTL}s`)
      .sign(Tokens.secret('JWT_REFRESH_SECRET'));
    return { max_age: STATE_TTL, state_cookie: stateCookie, url };
  } catch (error) {
    throw AuthMicrosoftError({ cause: error, metadata: { route: 'auth.service.authorize' } });
  }
};
