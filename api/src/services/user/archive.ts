import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { refreshTokens } from '@/db/schema/refresh-token.js';
import { users } from '@/db/schema/user.js';
import { UserArchiveError, UserNotFoundError } from '@/lib/errors/domains/user.js';
import { logService } from '@/services/log/index.js';
import { UserMapper } from '@/utils/user-mapper.js';

import type { ArchiveParams, ArchiveResponse } from './index.js';

/**
 * @route user.service.archive
 * @param {ArchiveParams} params
 * @returns {Promise<ArchiveResponse>}
 * @throws {UserArchiveError}
 */
export const archive = async (params: ArchiveParams): Promise<ArchiveResponse> => {
  try {
    const { actor, id } = params;
    const now = Date.now();
    const [row] = await db
      .update(users)
      .set({ archived_at: now, updated_at: now })
      .where(eq(users.id, id))
      .returning();
    if (row === undefined) {
      throw UserNotFoundError({ metadata: { route: 'user.service.archive', user_id: id } });
    }
    await db
      .update(refreshTokens)
      .set({ revoked_at: now })
      .where(and(eq(refreshTokens.user_id, id), isNull(refreshTokens.revoked_at)));
    await logService.create({ actor, event: 'user.archived', metadata: { user_id: id } });
    return { user: UserMapper.entity(row) };
  } catch (error) {
    throw UserArchiveError({ cause: error, metadata: { route: 'user.service.archive' } });
  }
};
