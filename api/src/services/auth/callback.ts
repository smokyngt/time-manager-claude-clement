import { eq } from 'drizzle-orm';
import { decodeJwt, jwtVerify } from 'jose';

import { db } from '@/db/client.js';
import { users } from '@/db/schema/user.js';
import { Microsoft } from '@/lib/auth/microsoft.js';
import { Tokens } from '@/lib/auth/tokens.js';
import {
  AuthMicrosoftError,
  AuthMicrosoftRejectedError,
  AuthMicrosoftUnavailableError,
  AuthMicrosoftUnknownUserError,
} from '@/lib/errors/domains/auth.js';
import { logService } from '@/services/log/index.js';

import { Session } from './session.js';

import type { CallbackParams, CallbackResponse } from './index.js';

/**
 * @route auth.service.callback
 * @param {CallbackParams} params
 * @returns {Promise<CallbackResponse>}
 * @throws {AuthMicrosoftError}
 */
export const callback = async (params: CallbackParams): Promise<CallbackResponse> => {
  try {
    const config = Microsoft.config();
    if (config === undefined) {
      throw AuthMicrosoftUnavailableError({ metadata: { route: 'auth.service.callback' } });
    }
    const { code, state, state_cookie: stateCookie } = params;
    const rejected = (): Error =>
      AuthMicrosoftRejectedError({ metadata: { route: 'auth.service.callback' } });
    if (stateCookie === undefined) throw rejected();
    const verified = await jwtVerify(stateCookie, Tokens.secret('JWT_REFRESH_SECRET'), {
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
    const body = (await response.json()) as { id_token?: string };
    if (typeof body.id_token !== 'string') throw rejected();
    const claims = decodeJwt(body.id_token);
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const issuer = claims.iss ?? '';
    if (
      !audience.includes(config.client_id) ||
      claims['nonce'] !== verified.payload['nonce'] ||
      (claims.exp ?? 0) * 1000 < Date.now() ||
      !issuer.startsWith('https://login.microsoftonline.com/')
    ) {
      throw rejected();
    }
    const oid = typeof claims['oid'] === 'string' ? claims['oid'] : claims.sub;
    const rawEmail = claims['email'] ?? claims['preferred_username'];
    const email = typeof rawEmail === 'string' ? rawEmail.toLowerCase() : undefined;
    if (oid === undefined) throw rejected();
    const [byOid] = await db.select().from(users).where(eq(users.microsoft_id, oid)).limit(1);
    const [byEmail] =
      byOid !== undefined || email === undefined
        ? []
        : await db.select().from(users).where(eq(users.email, email)).limit(1);
    const row = byOid ?? byEmail;
    if (row === undefined) {
      throw AuthMicrosoftUnknownUserError({ metadata: { route: 'auth.service.callback' } });
    }
    if (row.archived_at !== null) throw rejected();
    let linked = row;
    if (byOid === undefined) {
      if (row.microsoft_id !== null) throw rejected();
      const [updated] = await db
        .update(users)
        .set({ microsoft_id: oid, updated_at: Date.now() })
        .where(eq(users.id, row.id))
        .returning();
      linked = updated ?? row;
      await logService.create({
        actor: row,
        event: 'auth.microsoft_linked',
        metadata: { user_id: row.id },
      });
    }
    const session = await Session.issue({ user: linked });
    await logService.create({
      actor: linked,
      event: 'auth.logged_in',
      metadata: { method: 'microsoft', user_id: linked.id },
    });
    return session;
  } catch (error) {
    throw AuthMicrosoftError({ cause: error, metadata: { route: 'auth.service.callback' } });
  }
};
