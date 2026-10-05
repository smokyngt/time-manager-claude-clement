import { db } from '@/db/client.js';
import { users } from '@/db/schema/index.js';
import { DuplicateKeyError, UserCreateError  } from '@/lib/errors/index.js';
import { UserCreated } from '@/lib/events/index.js';
import { Audit } from '@/services/log/audit.js';
import { Cipher } from '@/utils/crypto/cipher.js';
import { Digest } from '@/utils/crypto/digest.js';
import { UserMapper } from '@/utils/mappers/user.js';
import { Password } from '@/utils/password.js';
import { Postgres } from '@/utils/postgres.js';

import type { CreateUserParams, CreateUserResponse } from './index.js';

/**
 * @route user.service.create
 * @param {CreateUserParams} params
 * @returns {Promise<CreateUserResponse>}
 * @throws {DuplicateKeyError | UserCreateError}
 */
export const create = async (params: CreateUserParams): Promise<CreateUserResponse> => {
  try {
    const { actor, data } = params;
    const { first_name: firstName, last_name: lastName, password } = data;
    const email = data.email.trim().toLowerCase();
    const passwordHash = password === undefined ? null : await Password.hash(password);
    const [row] = await db
      .insert(users)
      .values({
        email: Cipher.seal(email),
        email_hash: Digest.email(email),
        first_name: Cipher.seal(firstName),
        last_name: Cipher.seal(lastName),
        password_hash: passwordHash,
        phone_number: Cipher.nullable.seal(data.phone_number ?? null),
        role: data.role ?? 'employee',
      })
      .returning();
    if (row === undefined) throw UserCreateError({ metadata: { route: 'user.service.create' } });
    await Audit.record({
      actor,
      event: UserCreated.code,
      metadata: { role: row.role, user_id: row.id },
    });

    return { user: UserMapper.entity(row) };
  } catch (error) {
    const cause = Postgres.conflict(error)
      ? DuplicateKeyError({ cause: error, metadata: { route: 'user.service.create' } })
      : error;
    throw UserCreateError({ cause, metadata: { route: 'user.service.create' } });
  }
};
