import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { refreshTokens } from '@/db/schema/refresh-token.js';
import { Tokens } from '@/lib/auth/tokens.js';
import { AuthLogoutError } from '@/lib/errors/domains/auth.js';
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
    const { actor, token } = params;
    if (token !== undefined) {
      const [stored] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.token_hash, Tokens.hash(token)))
        .limit(1);
      if (stored?.user_id === actor.id) await Session.revoke(stored.family_id);
    }
    await logService.create({ actor, event: 'auth.logged_out', metadata: { user_id: actor.id } });
    return { success: true };
  } catch (error) {
    throw AuthLogoutError({ cause: error, metadata: { route: 'auth.service.logout' } });
  }
};
