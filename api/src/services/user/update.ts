import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { users } from '@/db/schema/user.js';
import { DuplicateKeyError } from '@/lib/errors/base/core.js';
import {
  UserNotFoundError,
  UserPasswordInvalidError,
  UserUpdateError,
} from '@/lib/errors/domains/user.js';
import { logService } from '@/services/log/index.js';
import { Cipher } from '@/utils/crypto/cipher.js';
import { Digest } from '@/utils/crypto/digest.js';
import { UserMapper } from '@/utils/mappers/user.js';
import { Password } from '@/utils/password.js';
import { Postgres } from '@/utils/postgres.js';

import { revoke } from './revoke.js';

import type { UpdateParams, UpdateResponse } from './index.js';
import type { UserInsert } from '@/db/schema/user.js';

/**
 * @route user.service.update
 * @param {UpdateParams} params
 * @returns {Promise<UpdateResponse>}
 * @throws {DuplicateKeyError | UserNotFoundError | UserPasswordInvalidError | UserUpdateError}
 */
export const update = async (params: UpdateParams): Promise<UpdateResponse> => {
  try {
    const { actor, data, id } = params;
    const {
      current_password: current,
      email,
      first_name: firstName,
      last_name: lastName,
      password,
    } = data;
    if (password !== undefined && actor.id === id) {
      const [existing] = await db
        .select({ password_hash: users.password_hash })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      if (existing === undefined) {
        throw UserNotFoundError({ metadata: { route: 'user.service.update', user_id: id } });
      }
      if (current === undefined || !(await Password.verify(current, existing.password_hash))) {
        throw UserPasswordInvalidError({ metadata: { route: 'user.service.update', user_id: id } });
      }
    }
    const values: Partial<UserInsert> = { updated_at: Date.now() };
    if (email !== undefined) {
      const normalized = email.trim().toLowerCase();
      values.email = Cipher.seal(normalized);
      values.email_hash = Digest.email(normalized);
    }
    if (firstName !== undefined) values.first_name = Cipher.seal(firstName);
    if (lastName !== undefined) values.last_name = Cipher.seal(lastName);
    if (data.phone_number !== undefined) {
      values.phone_number = Cipher.nullable.seal(data.phone_number);
    }
    if (data.role !== undefined) values.role = data.role;
    if (password !== undefined) values.password_hash = await Password.hash(password);
    const [row] = await db.update(users).set(values).where(eq(users.id, id)).returning();
    if (row === undefined) {
      throw UserNotFoundError({ metadata: { route: 'user.service.update', user_id: id } });
    }
    if (password !== undefined || email !== undefined || data.role !== undefined) {
      await revoke(id);
    }
    await logService.create({
      actor,
      event: 'user.updated',
      metadata: { fields: Object.keys(data), user_id: id },
    });

    return { user: UserMapper.entity(row) };
  } catch (error) {
    const cause = Postgres.conflict(error)
      ? DuplicateKeyError({ cause: error, metadata: { route: 'user.service.update' } })
      : error;
    throw UserUpdateError({ cause, metadata: { route: 'user.service.update' } });
  }
};
