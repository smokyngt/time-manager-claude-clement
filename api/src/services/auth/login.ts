import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { users } from '@/db/schema/user.js';
import { AuthInvalidCredentialsError, AuthLoginError } from '@/lib/errors/domains/auth.js';
import { logService } from '@/services/log/index.js';
import { Password } from '@/utils/password.js';

import type { LoginParams, LoginResponse } from './index.js';
import { Session } from './session.js';

/**
 * @route auth.service.login
 * @param {LoginParams} params
 * @returns {Promise<LoginResponse>}
 * @throws {AuthLoginError}
 */
export const login = async (params: LoginParams): Promise<LoginResponse> => {
  try {
    const { email, password } = params;
    const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    const valid = await Password.verify(password, row?.password_hash ?? null);
    if (row === undefined || !valid || row.archived_at !== null) {
      throw AuthInvalidCredentialsError({ metadata: { route: 'auth.service.login' } });
    }
    const session = await Session.issue({ user: row });
    await logService.create({
      actor: row,
      event: 'auth.logged_in',
      metadata: { method: 'password', user_id: row.id },
    });
    return session;
  } catch (error) {
    throw AuthLoginError({ cause: error, metadata: { route: 'auth.service.login' } });
  }
};
