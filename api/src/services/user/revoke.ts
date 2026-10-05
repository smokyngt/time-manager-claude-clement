import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { refreshTokens } from '@/db/schema/refresh-token.js';

/**
 * @route user.service.revoke
 * @param {string} userId
 * @returns {Promise<void>}
 */
export const revoke = async (userId: string): Promise<void> => {
  await db
    .update(refreshTokens)
    .set({ revoked_at: Date.now() })
    .where(and(eq(refreshTokens.user_id, userId), isNull(refreshTokens.revoked_at)));
};
