import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teamMembers, teams } from '@/db/schema/team.js';

import type { Actor } from '@/types/entities/actor.js';

export class Membership {
  /**
   * @route utils.membership.manages
   * @param {Actor} actor
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  public static async manages(actor: Actor, userId: string): Promise<boolean> {
    if (actor.role === 'admin') return true;
    if (actor.role !== 'manager') return false;
    const [row] = await db
      .select({ team_id: teamMembers.team_id })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.team_id))
      .where(
        and(
          eq(teams.manager_id, actor.id),
          eq(teamMembers.user_id, userId),
          isNull(teams.archived_at),
        ),
      )
      .limit(1);

    return row !== undefined;
  }

  /**
   * @route utils.membership.members
   * @param {string} managerId
   * @returns {Promise<string[]>}
   */
  public static async members(managerId: string): Promise<string[]> {
    const rows = await db
      .selectDistinct({ user_id: teamMembers.user_id })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.team_id))
      .where(and(eq(teams.manager_id, managerId), isNull(teams.archived_at)));

    return rows.map((row) => row.user_id);
  }

  /**
   * @route utils.membership.reaches
   * @param {Actor} actor
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  public static async reaches(actor: Actor, userId: string): Promise<boolean> {
    if (actor.id === userId) return true;

    return Membership.manages(actor, userId);
  }

  /**
   * @route utils.membership.teams
   * @param {string} userId
   * @returns {Promise<string[]>}
   */
  public static async teams(userId: string): Promise<string[]> {
    const rows = await db
      .select({ team_id: teamMembers.team_id })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.team_id))
      .where(and(eq(teamMembers.user_id, userId), isNull(teams.archived_at)));

    return rows.map((row) => row.team_id);
  }
}
