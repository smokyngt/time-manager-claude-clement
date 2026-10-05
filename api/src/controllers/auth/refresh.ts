import { Roles } from '@/config/auth/roles.js';
import { Cookies } from '@/lib/auth/cookies.js';
import { AuthRefreshError, AuthRefreshInvalidError } from '@/lib/errors/domains/auth.js';
import { AuthRefreshed } from '@/lib/events/domains/auth.js';
import { authService } from '@/services/auth/index.js';
import { Reply } from '@/utils/http/reply.js';

import type { SessionResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route auth.controller.refresh
 * @param {FastifyRequest} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<SessionResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {AuthRefreshError | AuthRefreshInvalidError}
 */
export const refresh = async (
  req: FastifyRequest,
  reply: FastifyReply<{ Reply: ReplyEnvelope<SessionResponse> }>,
): Promise<void> => {
  try {
    const token = req.cookies[Cookies.refresh];
    if (token === undefined || token === '') {
      throw AuthRefreshInvalidError({ metadata: { route: 'auth.controller.refresh' } });
    }
    const session = await authService.refresh({ token });
    Cookies.set(reply, session.refresh_token, session.refresh_expires_in);
    await Reply.send(req, reply, AuthRefreshed({ payload: { actor: session.user.id } }), {
      access_token: session.access_token,
      expires_in: session.expires_in,
      scopes: [...Roles.scopes(session.user.role)],
      token_type: 'Bearer',
      user: session.user,
    });
  } catch (error) {
    Cookies.clear(reply);
    throw AuthRefreshError({ cause: error, metadata: { route: 'auth.controller.refresh' } });
  }
};
