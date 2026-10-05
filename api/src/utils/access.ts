import type { FastifyRequest } from 'fastify';

import { ForbiddenError, UnauthorizedError } from '@/lib/errors/index.js';

import type { Actor } from '@/types/entities/actor.js';
import type { Role } from '@/types/entities/user.js';

export type UserAction = 'archive' | 'create' | 'delete' | 'list' | 'read' | 'restore' | 'update';

export interface UserTarget {
  id?: string;
  role: Role;
}

export interface AccessContext {
  actor: Actor;
}

const SELF_FIELDS = ['first_name', 'last_name', 'password', 'phone_number'];
const MANAGER_FIELDS = ['email', 'first_name', 'last_name', 'password', 'phone_number'];
const ADMIN_FIELDS = [...MANAGER_FIELDS, 'role'];

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
   * @throws {ForbiddenError}
   */
  public require(req: FastifyRequest, roles: Role[]): Actor {
    const { actor } = Access.context(req);
    if (!this.has(actor, roles)) {
      throw ForbiddenError({ metadata: { role: actor.role, route: 'access.role.require' } });
    }
    return actor;
  }
}

class UserAccess {
  /**
   * @route access.user.allow
   * @param {Actor} actor
   * @param {UserAction} action
   * @param {UserTarget} target
   * @returns {boolean}
   */
  public allow(actor: Actor, action: UserAction, target?: UserTarget): boolean {
    const self = target?.id !== undefined && target.id === actor.id;
    if (self && (action === 'archive' || action === 'delete')) return false;
    if (actor.role === 'admin') return true;
    if (actor.role === 'manager') {
      if (action === 'list') return true;
      if (target === undefined) return false;
      if (self) return action === 'read' || action === 'update';
      return target.role === 'employee';
    }
    return self && (action === 'read' || action === 'update');
  }

  /**
   * @route access.user.fields
   * @param {Actor} actor
   * @param {UserTarget} target
   * @returns {string[]}
   */
  public fields(actor: Actor, target: UserTarget): string[] {
    if (target.id === actor.id) return SELF_FIELDS;
    if (actor.role === 'admin') return ADMIN_FIELDS;
    if (actor.role === 'manager' && target.role === 'employee') return MANAGER_FIELDS;
    return [];
  }

  /**
   * @route access.user.reach
   * @param {Actor} actor
   * @param {string} id
   * @returns {boolean}
   */
  public reach(actor: Actor, id: string): boolean {
    return actor.role !== 'employee' || actor.id === id;
  }

  /**
   * @route access.user.require
   * @param {Actor} actor
   * @param {UserAction} action
   * @param {UserTarget} target
   * @returns {void}
   * @throws {ForbiddenError}
   */
  public require(actor: Actor, action: UserAction, target?: UserTarget): void {
    if (!this.allow(actor, action, target)) {
      throw ForbiddenError({
        metadata: { action, role: actor.role, route: 'access.user.require', target: target?.id },
      });
    }
  }
}

export class Access {
  public static readonly role = new RoleAccess();
  public static readonly user = new UserAccess();

  /**
   * @route access.context
   * @param {FastifyRequest} req
   * @returns {AccessContext}
   * @throws {UnauthorizedError}
   */
  public static context(req: FastifyRequest): AccessContext {
    if (req.actor === null || req.actor === undefined) {
      throw UnauthorizedError({ metadata: { route: 'access.context' } });
    }
    return { actor: req.actor };
  }
}
