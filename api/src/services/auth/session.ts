import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { refreshTokens } from '@/db/schema/refresh-token.js';
import { Tokens } from '@/lib/auth/tokens.js';
import { UserMapper } from '@/utils/user-mapper.js';

import type { UserRow } from '@/db/schema/user.js';
import type { User } from '@/types/entities/user.js';

export interface SessionResult {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  user: User;
}

export class Session {
  /**
   * @route auth.session.issue
   * @param {{ family_id?: string; user: UserRow }} params
   * @returns {Promise<SessionResult>}
   */
  public static async issue(params: { family_id?: string; user: UserRow }): Promise<SessionResult> {
    const { family_id: familyId, user } = params;
    const access = await Tokens.access(user);
    const refresh = Tokens.refresh();
    await db.insert(refreshTokens).values({
      expires_at: refresh.expires_at,
      family_id: familyId ?? crypto.randomUUID(),
      token_hash: refresh.hash,
      user_id: user.id,
    });
    return {
      access_token: access.token,
      expires_in: access.expires_in,
      refresh_expires_in: Tokens.refreshTtl(),
      refresh_token: refresh.token,
      user: UserMapper.entity(user),
    };
  }

  /**
   * @route auth.session.revoke
   * @param {string} familyId
   * @returns {Promise<void>}
   */
  public static async revoke(familyId: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revoked_at: Date.now() })
      .where(and(eq(refreshTokens.family_id, familyId), isNull(refreshTokens.revoked_at)));
  }
}
