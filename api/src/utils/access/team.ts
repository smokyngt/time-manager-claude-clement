import { ForbiddenError } from '@/lib/errors/index.js';

import type { Actor } from '@/types/entities/actor.js';

export type TeamAction = 'archive' | 'create' | 'delete' | 'list' | 'read' | 'restore' | 'update';

export interface TeamTarget {
  id?: string;
  manager_id?: string;
  member?: boolean;
}

const MANAGER_FIELDS = ['description', 'name', 'weekly_hours_target', 'work_end', 'work_start'];
const ADMIN_FIELDS = [...MANAGER_FIELDS, 'manager_id'];

export class TeamAccess {
  /**
   * @route access.team.allow
   * @param {Actor} actor
   * @param {TeamAction} action
   * @param {TeamTarget} target
   * @returns {boolean}
   */
  public allow(actor: Actor, action: TeamAction, target?: TeamTarget): boolean {
    if (actor.role === 'admin') return true;
    if (action === 'list') return true;
    if (actor.role === 'employee') return action === 'read' && target?.member === true;
    if (action === 'create') return target?.manager_id === actor.id;
    if (action === 'delete') return false;
    if (target === undefined) return false;
    if (this.manages(actor, target)) return true;
    return action === 'read' && target.member === true;
  }

  /**
   * @route access.team.fields
   * @param {Actor} actor
   * @param {TeamTarget} target
   * @returns {string[]}
   */
  public fields(actor: Actor, target: TeamTarget): string[] {
    if (actor.role === 'admin') return ADMIN_FIELDS;
    if (this.manages(actor, target)) return MANAGER_FIELDS;
    return [];
  }

  /**
   * @route access.team.manages
   * @param {Actor} actor
   * @param {TeamTarget} target
   * @returns {boolean}
   */
  public manages(actor: Actor, target: TeamTarget): boolean {
    return actor.role === 'manager' && target.manager_id === actor.id;
  }

  /**
   * @route access.team.require
   * @param {Actor} actor
   * @param {TeamAction} action
   * @param {TeamTarget} target
   * @returns {void}
   * @throws {ForbiddenError}
   */
  public require(actor: Actor, action: TeamAction, target?: TeamTarget): void {
    if (!this.allow(actor, action, target)) {
      throw ForbiddenError({
        metadata: { action, role: actor.role, route: 'access.team.require', target: target?.id },
      });
    }
  }
}
