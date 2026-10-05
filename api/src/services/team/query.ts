import { count, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teamMembers, teams } from '@/db/schema/index.js';

import type { SQL } from 'drizzle-orm';

export class TeamQuery {
  /**
   * @route team.query.count
   * @param {string} id
   * @returns {Promise<number>}
   */
  public static async count(id: string): Promise<number> {
    const [row] = await db
      .select({ total: count() })
      .from(teamMembers)
      .where(eq(teamMembers.team_id, id));

    return row?.total ?? 0;
  }

  /**
   * @route team.query.counts
   * @param {string[]} ids
   * @returns {Promise<Map<string, number>>}
   */
  public static async counts(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await db
      .select({ id: teamMembers.team_id, total: count() })
      .from(teamMembers)
      .where(inArray(teamMembers.team_id, ids))
      .groupBy(teamMembers.team_id);

    return new Map(rows.map((row) => [row.id, row.total]));
  }

  /**
   * @route team.query.member
   * @param {string} userId
   * @returns {SQL}
   */
  public static member(userId: string): SQL {
    return sql`${teams.id} in (select ${teamMembers.team_id} from ${teamMembers} where ${teamMembers.user_id} = ${userId})`;
  }
}
