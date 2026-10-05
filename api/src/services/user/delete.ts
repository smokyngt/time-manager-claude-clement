import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { users } from '@/db/schema/user.js';
import { UserDeleteError, UserNotFoundError } from '@/lib/errors/domains/user.js';
import { logService } from '@/services/log/index.js';

import type { DeleteParams, DeleteResponse } from './index.js';

/**
 * @route user.service.delete
 * @param {DeleteParams} params
 * @returns {Promise<DeleteResponse>}
 * @throws {UserDeleteError}
 */
export const remove = async (params: DeleteParams): Promise<DeleteResponse> => {
  try {
    const { actor, id } = params;
    const rows = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    if (rows.length === 0) {
      throw UserNotFoundError({ metadata: { route: 'user.service.delete', user_id: id } });
    }
    await logService.create({ actor, event: 'user.deleted', metadata: { user_id: id } });
    return { success: true };
  } catch (error) {
    throw UserDeleteError({ cause: error, metadata: { route: 'user.service.delete' } });
  }
};
