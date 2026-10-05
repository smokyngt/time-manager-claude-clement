import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { users } from '@/db/schema/index.js';
import { UserDeleteError, UserNotFoundError } from '@/lib/errors/index.js';
import { Sessions } from '@/lib/auth/sessions.js';
import { UserDeleted } from '@/lib/events/index.js';
import { Audit } from '@/services/log/audit.js';


import type { DeleteUserParams, DeleteUserResponse } from './index.js';

/**
 * @route user.service.delete
 * @param {DeleteUserParams} params
 * @returns {Promise<DeleteUserResponse>}
 * @throws {UserDeleteError | UserNotFoundError}
 */
export const remove = async (params: DeleteUserParams): Promise<DeleteUserResponse> => {
  try {
    const { actor, id } = params;
    await Sessions.revoke({ user_id: id });
    const rows = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    if (rows.length === 0) {
      throw UserNotFoundError({ metadata: { route: 'user.service.delete', user_id: id } });
    }
    await Audit.record({ actor, event: UserDeleted.code, metadata: { user_id: id } });

    return { success: true };
  } catch (error) {
    throw UserDeleteError({ cause: error, metadata: { route: 'user.service.delete' } });
  }
};
