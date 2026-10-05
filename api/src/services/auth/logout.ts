import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { refreshTokens } from '@/db/schema/index.js';
import { Tokens } from '@/lib/auth/tokens.js';
import { AuthLogoutError } from '@/lib/errors/index.js';
import { AuthLoggedOut } from '@/lib/events/index.js';
import { Audit } from '@/services/log/audit.js';

import { Session } from './session.js';

import type { AuthLogoutParams, AuthLogoutResponse } from './index.js';

/**
 * @route auth.service.logout
 * @param {AuthLogoutParams} params
 * @returns {Promise<AuthLogoutResponse>}
 * @throws {AuthLogoutError}
 */
export const logout = async (params: AuthLogoutParams): Promise<AuthLogoutResponse> => {
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
    await Audit.record({
      actor: null,
      event: AuthLoggedOut.code,
      metadata: { family_id: stored.family_id, user_id: stored.user_id },
    });

    return { success: true, user_id: stored.user_id };
  } catch (error) {
    throw AuthLogoutError({ cause: error, metadata: { route: 'auth.service.logout' } });
  }
};
