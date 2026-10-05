import { TokenAuthenticationError, UnauthorizedError } from '@/lib/errors/base/core.js';
import { TeamMemberAccess } from '@/utils/auth/access/team-member.js';
import { UserAccess } from '@/utils/auth/access/user.js';

import type { Scope } from '@/config/auth/scopes.js';
import type { Actor } from '@/types/entities/actor.js';
import type { Role } from '@/types/entities/user.js';
import type { FastifyRequest } from 'fastify';

export type AccessContext = {
  actor: Actor;
  scopes: readonly Scope[];
};

class RoleAccess {
  /**
   * @route access.role.has
   * @param {Actor} actor
   * @param {Role[]} roles
   * @returns {boolean}
   */
  public has(actor: Actor, roles: Role[]): boolean {
    return roles.includes(actor.role);
  }

  /**
   * @route access.role.require
   * @param {FastifyRequest} req
   * @param {Role[]} roles
   * @returns {Actor}
   * @throws {UnauthorizedError}
   */
  public require(req: FastifyRequest, roles: Role[]): Actor {
    const { actor } = Access.context(req);
    if (!this.has(actor, roles)) {
      throw UnauthorizedError({ metadata: { role: actor.role, route: 'access.role.require' } });
    }
    return actor;
  }
}

export class Access {
  public static readonly role = new RoleAccess();
  public static readonly teamMember = new TeamMemberAccess();
  public static readonly user = new UserAccess();

  /**
   * @route access.context
   * @param {FastifyRequest} req
   * @returns {AccessContext}
   * @throws {TokenAuthenticationError}
   */
  public static context(req: FastifyRequest): AccessContext {
    const actor = req.requestContext.get('user');
    if (actor === undefined) {
      throw TokenAuthenticationError({ metadata: { route: 'access.context' } });
    }

    return { actor, scopes: req.requestContext.get('scopes') ?? [] };
  }
}
