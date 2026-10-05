import { and, eq, isNull } from 'drizzle-orm';
import { decodeJwt, jwtVerify } from 'jose';

import { db } from '@/db/client.js';
import { users } from '@/db/schema/index.js';
import { Microsoft } from '@/lib/auth/microsoft.js';
import { Tokens } from '@/lib/auth/tokens.js';
import {
  AuthMicrosoftError,
  AuthMicrosoftRejectedError,
  AuthMicrosoftUnavailableError,
  AuthMicrosoftUnknownUserError,
} from '@/lib/errors/index.js';
import { AuthLoggedIn, AuthMicrosoftLinked } from '@/lib/events/index.js';
import { Audit } from '@/services/log/audit.js';
import { Digest } from '@/utils/crypto/digest.js';

import { Session } from './session.js';

import type { AuthCallbackParams, AuthCallbackResponse } from './index.js';

/**
 * @route auth.service.callback
 * @param {AuthCallbackParams} params
 * @returns {Promise<AuthCallbackResponse>}
 * @throws {AuthMicrosoftError | AuthMicrosoftRejectedError | AuthMicrosoftUnavailableError | AuthMicrosoftUnknownUserError}
 */
export const callback = async (params: AuthCallbackParams): Promise<AuthCallbackResponse> => {
  try {
    const config = Microsoft.config();
    if (config === undefined) {
      throw AuthMicrosoftUnavailableError({ metadata: { route: 'auth.service.callback' } });
    }
    const { code, state, state_cookie: stateCookie } = params;
    const rejected = (): Error =>
      AuthMicrosoftRejectedError({ metadata: { route: 'auth.service.callback' } });
    if (stateCookie === undefined) throw rejected();
    const verified = await jwtVerify(stateCookie, Tokens.secret('OAUTH_STATE_SECRET'), {
      algorithms: ['HS256'],
      audience: 'oauth-state',
    }).catch(() => undefined);
    if (verified === undefined || verified.payload['state'] !== state) throw rejected();
    const response = await fetch(`${Microsoft.base(config)}/token`, {
      body: new URLSearchParams({
        client_id: config.client_id,
        client_secret: config.client_secret,
        code,
        code_verifier: String(verified.payload['verifier']),
        grant_type: 'authorization_code',
        redirect_uri: config.redirect_uri,
        scope: 'openid profile email',
      }),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw rejected();
    const body: unknown = await response.json();
    const idToken =
      typeof body === 'object' && body !== null && 'id_token' in body ? body.id_token : undefined;
    if (typeof idToken !== 'string') throw rejected();
    const claims = decodeJwt(idToken);
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const tenant = typeof claims['tid'] === 'string' ? claims['tid'].toLowerCase() : undefined;
    const oid = typeof claims['oid'] === 'string' ? claims['oid'] : undefined;
    if (
      !audience.includes(config.client_id) ||
      claims['nonce'] !== verified.payload['nonce'] ||
      (claims.exp ?? 0) * 1000 < Date.now() ||
      tenant !== config.tenant ||
      oid === undefined ||
      claims.iss !== `https://login.microsoftonline.com/${tenant}/v2.0`
    ) {
      throw rejected();
    }
    const microsoftId = `${tenant}:${oid}`;
    const email =
      typeof claims['email'] === 'string' ? claims['email'].trim().toLowerCase() : undefined;
    const [byId] = await db
      .select()
      .from(users)
      .where(eq(users.microsoft_id, microsoftId))
      .limit(1);
    const [byEmail] =
      byId !== undefined || email === undefined
        ? []
        : await db.select().from(users).where(eq(users.email_hash, Digest.email(email))).limit(1);
    const row = byId ?? byEmail;
    if (row === undefined) {
      throw AuthMicrosoftUnknownUserError({ metadata: { route: 'auth.service.callback' } });
    }
    if (row.archived_at !== null) throw rejected();
    let linked = row;
    if (byId === undefined) {
      if (row.microsoft_id !== null) throw rejected();
      const [updated] = await db
        .update(users)
        .set({ microsoft_id: microsoftId, updated_at: Date.now() })
        .where(and(eq(users.id, row.id), isNull(users.microsoft_id)))
        .returning();
      if (updated === undefined) throw rejected();
      linked = updated;
      await Audit.record({
        actor: row,
        event: AuthMicrosoftLinked.code,
        metadata: { user_id: row.id },
      });
    }
    const session = await Session.issue({ user: linked });
    await Audit.record({
      actor: linked,
      event: AuthLoggedIn.code,
      metadata: { method: 'microsoft', user_id: linked.id },
    });
    return session;
  } catch (error) {
    throw AuthMicrosoftError({ cause: error, metadata: { route: 'auth.service.callback' } });
  }
};
