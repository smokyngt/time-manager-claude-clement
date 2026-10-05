import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { users } from '@/db/schema/user.js';
import { UserConflictError, UserNotFoundError, UserUpdateError } from '@/lib/errors/domains/user.js';
import { logService } from '@/services/log/index.js';
import { Password } from '@/utils/password.js';
import { Postgres } from '@/utils/postgres.js';
import { UserMapper } from '@/utils/user-mapper.js';

import type { UserInsert } from '@/db/schema/user.js';

import type { UpdateParams, UpdateResponse } from './index.js';

/**
 * @route user.service.update
 * @param {UpdateParams} params
 * @returns {Promise<UpdateResponse>}
 * @throws {UserUpdateError}
 */
export const update = async (params: UpdateParams): Promise<UpdateResponse> => {
  try {
    const { actor, data, id } = params;
    const { email, first_name: firstName, last_name: lastName, password } = data;
    const values: Partial<UserInsert> = { updated_at: Date.now() };
    if (email !== undefined) values.email = email.toLowerCase();
    if (firstName !== undefined) values.first_name = firstName;
    if (lastName !== undefined) values.last_name = lastName;
    if (data.phone_number !== undefined) values.phone_number = data.phone_number;
    if (data.role !== undefined) values.role = data.role;
    if (password !== undefined) values.password_hash = await Password.hash(password);
    const [row] = await db.update(users).set(values).where(eq(users.id, id)).returning();
    if (row === undefined) {
      throw UserNotFoundError({ metadata: { route: 'user.service.update', user_id: id } });
    }
    await logService.create({
      actor,
      event: 'user.updated',
      metadata: { fields: Object.keys(data), user_id: id },
    });
    return { user: UserMapper.entity(row) };
  } catch (error) {
    const cause = Postgres.conflict(error) ? UserConflictError({ cause: error }) : error;
    throw UserUpdateError({ cause, metadata: { route: 'user.service.update' } });
  }
};
