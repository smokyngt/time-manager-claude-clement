import { eq } from 'drizzle-orm';

import { Roles } from '@/config/auth/roles.js';
import { db } from '@/db/client.js';
import { users } from '@/db/schema/user.js';
import { Tokens } from '@/lib/auth/tokens.js';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors/index.js';

import type { Scope } from '@/config/auth/scopes.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

export interface AuthOptions {
  scopes: Scope[];
}

/**
 * @route plugins.auth
 * @param {AuthOptions} options
 * @returns {(req: FastifyRequest, reply: FastifyReply) => Promise<void>}
 * @throws {ForbiddenError | UnauthorizedError}
 */
export const auth = (
  options: AuthOptions,
): ((req: FastifyRequest, reply: FastifyReply) => Promise<void>) => {
  return async (req: FastifyRequest): Promise<void> => {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ') !== true) {
      throw UnauthorizedError({ metadata: { route: 'plugins.auth' } });
    }
    const claims = await Tokens.verify(header.slice(7));
    const [row] = await db
      .select({ archived_at: users.archived_at, id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, claims.id))
      .limit(1);
    if (row === undefined || row.archived_at !== null) {
      throw UnauthorizedError({ metadata: { route: 'plugins.auth' } });
    }
    const granted = Roles.scopes(row.role);
    if (!options.scopes.every((scope) => granted.includes(scope))) {
      throw ForbiddenError({ metadata: { route: 'plugins.auth', scopes: options.scopes } });
    }
    req.actor = { id: row.id, role: row.role, team_ids: [] };
  };
};
