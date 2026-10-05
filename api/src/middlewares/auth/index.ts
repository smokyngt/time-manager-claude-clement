import { Roles } from '@/config/auth/roles.js';
import { Tokens } from '@/lib/auth/tokens.js';
import { TokenAuthenticationError, UnauthorizedError } from '@/lib/errors/base/core.js';

import { Identity } from './identity.js';

import type { Scope } from '@/config/auth/scopes.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

export type AuthOptions = {
  scopes: Scope[];
};

export type Prehandler = (req: FastifyRequest, reply: FastifyReply) => Promise<void>;

/**
 * @route middlewares.auth
 * @param {AuthOptions} options
 * @returns {Prehandler}
 * @throws {TokenAuthenticationError | UnauthorizedError}
 */
export const auth = (options: AuthOptions): Prehandler => {
  return async (req: FastifyRequest): Promise<void> => {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ') !== true) {
      throw TokenAuthenticationError({
        metadata: { reason: 'missing_token', route: 'middlewares.auth' },
      });
    }
    const claims = await Tokens.verify(header.slice(7)).catch((error: unknown) => {
      throw TokenAuthenticationError({
        cause: error,
        metadata: { reason: 'invalid_token', route: 'middlewares.auth' },
      });
    });
    const user = await Identity.load(claims.id);
    const granted = Roles.scopes(user.role);
    const missing = options.scopes.filter((scope) => !granted.includes(scope));
    if (missing.length > 0) {
      throw UnauthorizedError({
        metadata: { missing_scopes: missing, role: user.role, route: 'middlewares.auth' },
      });
    }
    req.requestContext.set('user', user);
    req.requestContext.set('scopes', granted);
  };
};
