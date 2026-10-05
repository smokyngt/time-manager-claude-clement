import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { users } from '@/db/schema/index.js';
import { TokenAuthenticationError } from '@/lib/errors/index.js';

import type { Actor } from '@/types/entities/index.js';

export class Identity {
  /**
   * @route identity.load
   * @param {string} actorId
   * @returns {Promise<Actor>}
   * @throws {TokenAuthenticationError}
   */
  public static async load(actorId: string): Promise<Actor> {
    const [row] = await db
      .select({ archived_at: users.archived_at, id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, actorId))
      .limit(1);
    if (row === undefined || row.archived_at !== null) {
      throw TokenAuthenticationError({
        metadata: { actor_id: actorId, reason: 'user_unavailable', route: 'identity.load' },
      });
    }

    return { id: row.id, role: row.role, team_ids: [] };
  }
}
