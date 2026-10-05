import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { refreshTokens } from '@/db/schema/refresh-token.js';
import { users } from '@/db/schema/user.js';
import { Tokens } from '@/lib/auth/tokens.js';
import { AuthRefreshError, AuthSessionInvalidError } from '@/lib/errors/domains/auth.js';
import { logService } from '@/services/log/index.js';

import { Session } from './session.js';

import type { RefreshParams, RefreshResponse } from './index.js';

/**
 * @route auth.service.refresh
 * @param {RefreshParams} params
 * @returns {Promise<RefreshResponse>}
 * @throws {AuthRefreshError}
 */
export const refresh = async (params: RefreshParams): Promise<RefreshResponse> => {
  try {
    const now = Date.now();
    const [stored] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token_hash, Tokens.hash(params.token)))
      .limit(1);
    if (stored === undefined) {
      throw AuthSessionInvalidError({ metadata: { route: 'auth.service.refresh' } });
    }
    const [claimed] =
      stored.revoked_at === null && stored.expires_at > now
        ? await db
            .update(refreshTokens)
            .set({ revoked_at: now })
            .where(and(eq(refreshTokens.id, stored.id), isNull(refreshTokens.revoked_at)))
            .returning({ id: refreshTokens.id })
        : [];
    if (claimed === undefined && !(await Session.grace({ now, stored }))) {
      if (stored.revoked_at !== null || stored.expires_at <= now) {
        await Session.revoke(stored.family_id);
      }
      if (stored.revoked_at !== null) {
        await logService.create({
          actor: null,
          event: 'auth.refresh_reuse_detected',
          metadata: { family_id: stored.family_id, user_id: stored.user_id },
        });
      }
      throw AuthSessionInvalidError({ metadata: { route: 'auth.service.refresh' } });
    }
    const [row] = await db.select().from(users).where(eq(users.id, stored.user_id)).limit(1);
    if (row === undefined || row.archived_at !== null) {
      await Session.revoke(stored.family_id);
      throw AuthSessionInvalidError({ metadata: { route: 'auth.service.refresh' } });
    }
    return await Session.issue({ family_id: stored.family_id, user: row });
  } catch (error) {
    throw AuthRefreshError({ cause: error, metadata: { route: 'auth.service.refresh' } });
  }
};
