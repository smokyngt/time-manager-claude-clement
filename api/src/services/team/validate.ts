import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { users } from '@/db/schema/index.js';
import { TeamManagerInvalidError, TeamScheduleInvalidError } from '@/lib/errors/index.js';

export class TeamValidate {
  /**
   * @route team.service.validate.manager
   * @param {string} id
   * @returns {Promise<void>}
   * @throws {TeamManagerInvalidError}
   */
  public static async manager(id: string): Promise<void> {
    const [row] = await db
      .select({ archived_at: users.archived_at, role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (row === undefined || row.archived_at !== null || row.role === 'employee') {
      throw TeamManagerInvalidError({
        metadata: { manager_id: id, route: 'team.service.validate.manager' },
      });
    }
  }

  /**
   * @route team.service.validate.schedule
   * @param {string} start
   * @param {string} end
   * @returns {void}
   * @throws {TeamScheduleInvalidError}
   */
  public static schedule(start: string, end: string): void {
    if (end <= start) {
      throw TeamScheduleInvalidError({ metadata: { route: 'team.service.validate.schedule' } });
    }
  }
}
