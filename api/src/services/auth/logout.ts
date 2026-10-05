import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { refreshTokens } from '@/db/schema/refresh-token.js';
import { Tokens } from '@/lib/auth/tokens.js';
import { AuthLogoutError } from '@/lib/errors/domains/auth.js';
import { AuthLoggedOut } from '@/lib/events/domains/auth.js';
import { logService } from '@/services/log/index.js';

import { Session } from './session.js';

import type { LogoutParams, LogoutResponse } from './index.js';

/**
 * @route auth.service.logout
 * @param {LogoutParams} params
 * @returns {Promise<LogoutResponse>}
 * @throws {AuthLogoutError}
 */
export const logout = async (params: LogoutParams): Promise<LogoutResponse> => {
  try {
    const { token } = params;
    if (token === undefined || token === '') return { success: true, user_id: undefined };
    const [stored] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token_hash, Tokens.hash(token)))
      .limit(1);
    if (stored === undefined) return { success: true, user_id: undefined };
    await Session.revoke(stored.family_id);
    await logService.create({
      actor: null,
      event: AuthLoggedOut.code,
      metadata: { family_id: stored.family_id, user_id: stored.user_id },
    });

    return { success: true, user_id: stored.user_id };
  } catch (error) {
    throw AuthLogoutError({ cause: error, metadata: { route: 'auth.service.logout' } });
  }
};
