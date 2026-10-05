import { and, eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teamMembers, teams } from '@/db/schema/team.js';
import { TeamMemberTeamNotFoundError } from '@/lib/errors/domains/team-member.js';
import { ForbiddenError } from '@/lib/errors/index.js';

import type { TeamRow } from '@/db/schema/team.js';
import type { Actor } from '@/types/entities/actor.js';

export class TeamMemberAccess {
  /**
   * @route team_member.access.load
   * @param {string} id
   * @param {string} route
   * @returns {Promise<TeamRow>}
   * @throws {TeamMemberTeamNotFoundError}
   */
  public static async load(id: string, route: string): Promise<TeamRow> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (team === undefined) {
      throw TeamMemberTeamNotFoundError({ metadata: { route, team_id: id } });
    }

    return team;
  }

  /**
   * @route team_member.access.manage
   * @param {Actor} actor
   * @param {TeamRow} team
   * @param {string} route
   * @returns {void}
   * @throws {ForbiddenError}
   */
  public static manage(actor: Actor, team: TeamRow, route: string): void {
    if (actor.role === 'admin') return;
    if (actor.role === 'manager' && team.manager_id === actor.id) return;
    throw ForbiddenError({ metadata: { route, team_id: team.id } });
  }

  /**
   * @route team_member.access.view
   * @param {Actor} actor
   * @param {TeamRow} team
   * @param {string} route
   * @returns {Promise<void>}
   * @throws {ForbiddenError}
   */
  public static async view(actor: Actor, team: TeamRow, route: string): Promise<void> {
    if (actor.role === 'admin' || team.manager_id === actor.id) return;
    const [member] = await db
      .select({ user_id: teamMembers.user_id })
      .from(teamMembers)
      .where(and(eq(teamMembers.team_id, team.id), eq(teamMembers.user_id, actor.id)))
      .limit(1);
    if (member === undefined) {
      throw ForbiddenError({ metadata: { route, team_id: team.id } });
    }
  }
}
