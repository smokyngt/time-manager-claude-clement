import { and, eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teamMembers } from '@/db/schema/index.js';
import { UnauthorizedError } from '@/lib/errors/index.js';

import type { TeamRow } from '@/db/schema/index.js';
import type { Actor, Role  } from '@/types/entities/index.js';

export class TeamMemberAccess {
  /**
   * @route access.team_member.manage
   * @param {Actor} actor
   * @param {TeamRow} team
   * @returns {void}
   * @throws {UnauthorizedError}
   */
  public manage(actor: Actor, team: TeamRow): void {
    if (actor.role === 'admin') return;
    if (actor.role === 'manager' && team.manager_id === actor.id) return;
    throw UnauthorizedError({
      metadata: { role: actor.role, route: 'access.team_member.manage', team_id: team.id },
    });
  }

  /**
   * @route access.team_member.roles
   * @param {Actor} actor
   * @returns {Role[]}
   */
  public roles(actor: Actor): Role[] {
    return actor.role === 'admin' ? ['admin', 'employee', 'manager'] : ['employee'];
  }

  /**
   * @route access.team_member.view
   * @param {Actor} actor
   * @param {TeamRow} team
   * @returns {Promise<void>}
   * @throws {UnauthorizedError}
   */
  public async view(actor: Actor, team: TeamRow): Promise<void> {
    if (actor.role === 'admin' || team.manager_id === actor.id) return;
    const [member] = await db
      .select({ user_id: teamMembers.user_id })
      .from(teamMembers)
      .where(and(eq(teamMembers.team_id, team.id), eq(teamMembers.user_id, actor.id)))
      .limit(1);
    if (member === undefined) {
      throw UnauthorizedError({
        metadata: { role: actor.role, route: 'access.team_member.view', team_id: team.id },
      });
    }
  }
}
