import { and, eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teamMembers } from '@/db/schema/index.js';
import { UnauthorizedError } from '@/lib/errors/index.js';

import type { Actor } from '@/types/entities/index.js';

export type TeamAction = 'archive' | 'create' | 'delete' | 'list' | 'read' | 'restore' | 'update';

export type TeamTarget = {
  id?: string;
  manager_id: string;
};

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
    if (action === 'list' || action === 'read') return true;
    if (actor.role === 'employee' || action === 'delete') return false;
    if (action === 'create') return target?.manager_id === actor.id;

    return target !== undefined && this.manages(actor, target);
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
   * @throws {UnauthorizedError}
   */
  public require(actor: Actor, action: TeamAction, target?: TeamTarget): void {
    if (!this.allow(actor, action, target)) {
      throw UnauthorizedError({
        metadata: { action, role: actor.role, route: 'access.team.require', target: target?.id },
      });
    }
  }

  /**
   * @route access.team.scope
   * @param {Actor} actor
   * @param {Required<TeamTarget>} target
   * @returns {Promise<boolean>}
   */
  public async scope(actor: Actor, target: Required<TeamTarget>): Promise<boolean> {
    if (actor.role === 'admin' || this.manages(actor, target)) return true;
    const [row] = await db
      .select({ user_id: teamMembers.user_id })
      .from(teamMembers)
      .where(and(eq(teamMembers.team_id, target.id), eq(teamMembers.user_id, actor.id)))
      .limit(1);

    return row !== undefined;
  }
}
