import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { users } from '@/db/schema/index.js';
import { Limiter } from '@/lib/auth/limiter.js';
import {
  AuthCredentialsInvalidError,
  AuthLoginError,
  AuthRateLimitedError,
} from '@/lib/errors/index.js';
import { AuthLoggedIn } from '@/lib/events/index.js';
import { Audit } from '@/services/log/audit.js';
import { Digest } from '@/utils/crypto/digest.js';
import { Password } from '@/utils/password.js';

import { Session } from './session.js';

import type { AuthLoginParams, AuthLoginResponse } from './index.js';

/**
 * @route auth.service.login
 * @param {AuthLoginParams} params
 * @returns {Promise<AuthLoginResponse>}
 * @throws {AuthCredentialsInvalidError | AuthLoginError | AuthRateLimitedError}
 */
export const login = async (params: AuthLoginParams): Promise<AuthLoginResponse> => {
  try {
    const { email, password } = params;
    if (Limiter.blocked(email)) {
      throw AuthRateLimitedError({
        metadata: { route: 'auth.service.login' },
        retry_after: Limiter.retry(email),
      });
    }
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.email_hash, Digest.email(email)))
      .limit(1);
    const valid = await Password.verify(password, row?.password_hash ?? null);
    if (row === undefined || !valid || row.archived_at !== null) {
      Limiter.fail(email);
      throw AuthCredentialsInvalidError({ metadata: { route: 'auth.service.login' } });
    }
    Limiter.clear(email);
    const session = await Session.issue({ user: row });
    await Audit.record({
      actor: row,
      event: AuthLoggedIn.code,
      metadata: { method: 'password', user_id: row.id },
    });

    return session;
  } catch (error) {
    throw AuthLoginError({ cause: error, metadata: { route: 'auth.service.login' } });
  }
};
