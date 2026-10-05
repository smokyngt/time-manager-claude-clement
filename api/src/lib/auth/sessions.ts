import { and, eq, isNotNull, isNull, lt, or } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { refreshTokens } from '@/db/schema/refresh-token.js';

const RETENTION = 30 * 86_400_000;

export class Sessions {
  /**
   * @route sessions.purge
   * @returns {Promise<{ deleted: number }>}
   */
  public static async purge(): Promise<{ deleted: number }> {
    const now = Date.now();
    const rows = await db
      .delete(refreshTokens)
      .where(
        or(
          lt(refreshTokens.expires_at, now),
          and(isNotNull(refreshTokens.revoked_at), lt(refreshTokens.revoked_at, now - RETENTION)),
        ),
      )
      .returning({ id: refreshTokens.id });

    return { deleted: rows.length };
  }

  /**
   * @route sessions.revoke
   * @param {{ user_id: string }} params
   * @returns {Promise<void>}
   */
  public static async revoke(params: { user_id: string }): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revoked_at: Date.now() })
      .where(and(eq(refreshTokens.user_id, params.user_id), isNull(refreshTokens.revoked_at)));
  }
}
