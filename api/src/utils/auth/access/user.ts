import { UnauthorizedError } from '@/lib/errors/index.js';
import { Membership } from '@/utils/membership.js';

import type { Actor, Role  } from '@/types/entities/index.js';

export type UserAction = 'archive' | 'create' | 'delete' | 'list' | 'read' | 'restore' | 'update';

export type UserTarget = {
  id?: string;
  role: Role;
};

const SELF_FIELDS = ['current_password', 'first_name', 'last_name', 'password', 'phone_number'];
const MANAGER_FIELDS = ['email', 'first_name', 'last_name', 'password', 'phone_number'];
const ADMIN_FIELDS = [...MANAGER_FIELDS, 'role'];

export class UserAccess {
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
   * @throws {UnauthorizedError}
   */
  public require(actor: Actor, action: UserAction, target?: UserTarget): void {
    if (!this.allow(actor, action, target)) {
      throw UnauthorizedError({
        metadata: { action, role: actor.role, route: 'access.user.require', target: target?.id },
      });
    }
  }

  /**
   * @route access.user.scope
   * @param {Actor} actor
   * @param {UserTarget} target
   * @returns {Promise<boolean>}
   */
  public async scope(actor: Actor, target: Required<UserTarget>): Promise<boolean> {
    if (actor.role !== 'manager' || actor.id === target.id) return true;
    if (await Membership.manages(actor, target.id)) return true;
    if (target.role !== 'employee') return false;
    const teams = await Membership.teams(target.id);

    return teams.length === 0;
  }
}
