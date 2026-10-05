import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { users } from '@/db/schema/index.js';
import { Sessions } from '@/lib/auth/sessions.js';
import { UserArchiveError, UserNotFoundError } from '@/lib/errors/index.js';
import { UserArchived } from '@/lib/events/index.js';
import { Audit } from '@/services/log/audit.js';
import { UserMapper } from '@/utils/mappers/user.js';

import type { ArchiveUserParams, ArchiveUserResponse } from './index.js';

/**
 * @route user.service.archive
 * @param {ArchiveUserParams} params
 * @returns {Promise<ArchiveUserResponse>}
 * @throws {UserArchiveError | UserNotFoundError}
 */
export const archive = async (params: ArchiveUserParams): Promise<ArchiveUserResponse> => {
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
    await Sessions.revoke({ user_id: id });
    await Audit.record({ actor, event: UserArchived.code, metadata: { user_id: id } });

    return { user: UserMapper.entity(row) };
  } catch (error) {
    throw UserArchiveError({ cause: error, metadata: { route: 'user.service.archive' } });
  }
};
