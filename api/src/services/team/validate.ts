import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { users } from '@/db/schema/user.js';
import { TeamManagerInvalidError, TeamScheduleInvalidError } from '@/lib/errors/domains/team.js';

export class TeamValidate {
  /**
   * @route team.validate.manager
   * @param {string} id
   * @param {string} route
   * @returns {Promise<void>}
   * @throws {TeamManagerInvalidError}
   */
  public static async manager(id: string, route: string): Promise<void> {
    const [row] = await db
      .select({ archived_at: users.archived_at, role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (row === undefined || row.archived_at !== null || row.role === 'employee') {
      throw TeamManagerInvalidError({ metadata: { manager_id: id, route } });
    }
  }

  /**
   * @route team.validate.schedule
   * @param {string} start
   * @param {string} end
   * @param {string} route
   * @returns {void}
   * @throws {TeamScheduleInvalidError}
   */
  public static schedule(start: string, end: string, route: string): void {
    if (end <= start) {
      throw TeamScheduleInvalidError({ metadata: { route } });
    }
  }
}
