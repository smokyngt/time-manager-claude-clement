import { and, eq, gt, isNull } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { refreshTokens } from '@/db/schema/refresh-token.js';
import { Tokens } from '@/lib/auth/tokens.js';
import { UserMapper } from '@/utils/mappers/user.js';

import type { RefreshTokenRow } from '@/db/schema/refresh-token.js';
import type { UserRow } from '@/db/schema/user.js';
import type { User } from '@/types/entities/user.js';

export type SessionResult = {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  user: User;
};

const GRACE = 10_000;

export class Session {
  /**
   * @route auth.session.grace
   * @param {{ now: number; stored: RefreshTokenRow }} params
   * @returns {Promise<boolean>}
   */
  public static async grace(params: { now: number; stored: RefreshTokenRow }): Promise<boolean> {
    const { now, stored } = params;
    if (stored.revoked_at === null || now - stored.revoked_at >= GRACE) return false;
    if (stored.expires_at <= now) return false;
    const [live] = await db
      .select({ id: refreshTokens.id })
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.family_id, stored.family_id),
          isNull(refreshTokens.revoked_at),
          gt(refreshTokens.expires_at, now),
        ),
      )
      .limit(1);

    return live !== undefined;
  }

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
