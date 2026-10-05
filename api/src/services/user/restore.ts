import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { users } from '@/db/schema/index.js';
import { UserNotFoundError, UserRestoreError } from '@/lib/errors/index.js';
import { UserRestored } from '@/lib/events/index.js';
import { Audit } from '@/services/log/audit.js';
import { UserMapper } from '@/utils/mappers/user.js';

import type { RestoreUserParams, RestoreUserResponse } from './index.js';

/**
 * @route user.service.restore
 * @param {RestoreUserParams} params
 * @returns {Promise<RestoreUserResponse>}
 * @throws {UserNotFoundError | UserRestoreError}
 */
export const restore = async (params: RestoreUserParams): Promise<RestoreUserResponse> => {
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
    await Audit.record({ actor, event: UserRestored.code, metadata: { user_id: id } });

    return { user: UserMapper.entity(row) };
  } catch (error) {
    throw UserRestoreError({ cause: error, metadata: { route: 'user.service.restore' } });
  }
};
