import { db } from '@/db/client.js';
import { users } from '@/db/schema/user.js';
import { UserConflictError, UserCreateError } from '@/lib/errors/domains/user.js';
import { logService } from '@/services/log/index.js';
import { Password } from '@/utils/password.js';
import { Postgres } from '@/utils/postgres.js';
import { UserMapper } from '@/utils/user-mapper.js';

import type { CreateParams, CreateResponse } from './index.js';

/**
 * @route user.service.create
 * @param {CreateParams} params
 * @returns {Promise<CreateResponse>}
 * @throws {UserCreateError}
 */
export const create = async (params: CreateParams): Promise<CreateResponse> => {
  try {
    const { actor, data } = params;
    const { email, first_name: firstName, last_name: lastName, password } = data;
    const passwordHash = password === undefined ? null : await Password.hash(password);
    const [row] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        first_name: firstName,
        last_name: lastName,
        password_hash: passwordHash,
        phone_number: data.phone_number ?? null,
        role: data.role ?? 'employee',
      })
      .returning();
    if (row === undefined) throw UserCreateError({ metadata: { route: 'user.service.create' } });
    await logService.create({
      actor,
      event: 'user.created',
      metadata: { role: row.role, user_id: row.id },
    });
    return { user: UserMapper.entity(row) };
  } catch (error) {
    const cause = Postgres.conflict(error) ? UserConflictError({ cause: error }) : error;
    throw UserCreateError({ cause, metadata: { route: 'user.service.create' } });
  }
};
