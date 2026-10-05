import { UnauthorizedError } from '@/lib/errors/base/core.js';
import { Membership } from '@/utils/membership.js';

import type { Actor } from '@/types/entities/actor.js';

export type ClockAction = 'create' | 'delete' | 'read' | 'update';

export type ClockTarget = {
  user_id: string;
};

export class ClockAccess {
  /**
   * @route access.clock.allow
   * @param {Actor} actor
   * @param {ClockAction} action
   * @param {ClockTarget} target
   * @returns {Promise<boolean>}
   */
  public async allow(actor: Actor, action: ClockAction, target: ClockTarget): Promise<boolean> {
    if (actor.role === 'admin') return true;
    if (action === 'read' && actor.id === target.user_id) return true;
    if (actor.role !== 'manager') return false;

    return Membership.manages(actor, target.user_id);
  }

  /**
   * @route access.clock.require
   * @param {Actor} actor
   * @param {ClockAction} action
   * @param {ClockTarget} target
   * @returns {Promise<void>}
   * @throws {UnauthorizedError}
   */
  public async require(actor: Actor, action: ClockAction, target: ClockTarget): Promise<void> {
    if (!(await this.allow(actor, action, target))) {
      throw UnauthorizedError({
        metadata: {
          action,
          role: actor.role,
          route: 'access.clock.require',
          target: target.user_id,
        },
      });
    }
  }

  /**
   * @route access.clock.scope
   * @param {Actor} actor
   * @param {ClockTarget} target
   * @returns {Promise<boolean>}
   */
  public async scope(actor: Actor, target: ClockTarget): Promise<boolean> {
    if (actor.role === 'admin' || actor.id === target.user_id) return true;
    if (actor.role !== 'manager') return false;

    return Membership.manages(actor, target.user_id);
  }

  /**
   * @route access.clock.users
   * @param {Actor} actor
   * @param {string[] | undefined} requested
   * @returns {Promise<string[] | undefined>}
   */
  public async users(actor: Actor, requested?: string[]): Promise<string[] | undefined> {
    if (actor.role === 'employee') return [actor.id];
    if (actor.role === 'admin') return requested;
    const allowed = new Set([actor.id, ...(await Membership.members(actor.id))]);

    return requested === undefined ? [...allowed] : requested.filter((id) => allowed.has(id));
  }
}
