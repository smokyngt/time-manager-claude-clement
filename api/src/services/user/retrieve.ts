import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { users } from '@/db/schema/index.js';
import { UserNotFoundError, UserRetrieveError } from '@/lib/errors/index.js';
import { UserMapper } from '@/utils/mappers/user.js';

import type { RetrieveUserParams, RetrieveUserResponse } from './index.js';

/**
 * @route user.service.retrieve
 * @param {RetrieveUserParams} params
 * @returns {Promise<RetrieveUserResponse>}
 * @throws {UserNotFoundError | UserRetrieveError}
 */
export const retrieve = async (params: RetrieveUserParams): Promise<RetrieveUserResponse> => {
  try {
    const { id } = params;
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (row === undefined) {
      throw UserNotFoundError({ metadata: { route: 'user.service.retrieve', user_id: id } });
    }

    return { user: UserMapper.entity(row) };
  } catch (error) {
    throw UserRetrieveError({ cause: error, metadata: { route: 'user.service.retrieve' } });
  }
};
