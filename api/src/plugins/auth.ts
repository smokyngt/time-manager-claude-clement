import type { FastifyReply, FastifyRequest } from 'fastify';

import { Roles } from '@/config/auth/roles.js';
import { Tokens } from '@/lib/auth/tokens.js';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors/index.js';

import type { Scope } from '@/config/auth/scopes.js';

export interface AuthOptions {
  scopes: Scope[];
}

/**
 * @route plugins.auth
 * @param {AuthOptions} options
 * @returns {(req: FastifyRequest, reply: FastifyReply) => Promise<void>}
 * @throws {UnauthorizedError}
 */
export const auth = (
  options: AuthOptions,
): ((req: FastifyRequest, reply: FastifyReply) => Promise<void>) => {
  return async (req: FastifyRequest): Promise<void> => {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ') !== true) {
      throw UnauthorizedError({ metadata: { route: 'plugins.auth' } });
    }
    const actor = await Tokens.verify(header.slice(7));
    const granted = Roles.scopes(actor.role);
    if (!options.scopes.every((scope) => granted.includes(scope))) {
      throw ForbiddenError({ metadata: { route: 'plugins.auth', scopes: options.scopes } });
    }
    req.actor = actor;
  };
};
