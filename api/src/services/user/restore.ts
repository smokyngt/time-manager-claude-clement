import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { users } from '@/db/schema/user.js';
import { UserNotFoundError, UserRestoreError } from '@/lib/errors/domains/user.js';
import { logService } from '@/services/log/index.js';
import { UserMapper } from '@/utils/user-mapper.js';

import type { RestoreParams, RestoreResponse } from './index.js';

/**
 * @route user.service.restore
 * @param {RestoreParams} params
 * @returns {Promise<RestoreResponse>}
 * @throws {UserRestoreError}
 */
export const restore = async (params: RestoreParams): Promise<RestoreResponse> => {
  try {
    const { actor, id } = params;
    const [row] = await db
      .update(users)
      .set({ archived_at: null, updated_at: Date.now() })
      .where(eq(users.id, id))
      .returning();
    if (row === undefined) {
      throw UserNotFoundError({ metadata: { route: 'user.service.restore', user_id: id } });
    }
    await logService.create({ actor, event: 'user.restored', metadata: { user_id: id } });
    return { user: UserMapper.entity(row) };
  } catch (error) {
    throw UserRestoreError({ cause: error, metadata: { route: 'user.service.restore' } });
  }
};
