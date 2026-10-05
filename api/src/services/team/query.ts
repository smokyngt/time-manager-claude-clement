import { inArray, sql } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teamMembers, teams } from '@/db/schema/team.js';

import type { SQL } from 'drizzle-orm';

export class TeamQuery {
  /**
   * @route team.query.count
   * @param {string} id
   * @returns {Promise<number>}
   */
  public static async count(id: string): Promise<number> {
    const counts = await TeamQuery.counts([id]);

    return counts.get(id) ?? 0;
  }

  /**
   * @route team.query.counts
   * @param {string[]} ids
   * @returns {Promise<Map<string, number>>}
   */
  public static async counts(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await db
      .select({
        id: teams.id,
        total: sql<number>`(select count(*) from ${teamMembers} where ${teamMembers.team_id} = ${teams.id})::int`,
      })
      .from(teams)
      .where(inArray(teams.id, ids));

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
