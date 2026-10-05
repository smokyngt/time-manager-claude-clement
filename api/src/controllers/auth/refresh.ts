import type { FastifyReply, FastifyRequest } from 'fastify';

import { Cookies } from '@/lib/auth/cookies.js';
import { AuthRefreshError, AuthSessionInvalidError } from '@/lib/errors/domains/auth.js';
import { AuthRefreshed } from '@/lib/events/domains/auth.js';
import { authService } from '@/services/auth/index.js';
import { Reply } from '@/utils/reply.js';

import type { ReplyEnvelope } from '@/types/envelope.js';

import type { SessionResponse } from './index.js';

/**
 * @route auth.controller.refresh
 * @param {FastifyRequest} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<SessionResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {AuthRefreshError}
 */
export const refresh = async (
  req: FastifyRequest,
  reply: FastifyReply<{ Reply: ReplyEnvelope<SessionResponse> }>,
): Promise<void> => {
  try {
    const token = req.cookies[Cookies.refresh];
    if (token === undefined || token === '') {
      throw AuthSessionInvalidError({ metadata: { route: 'auth.controller.refresh' } });
    }
    const session = await authService.refresh({ token });
    Cookies.set(reply, session.refresh_token, session.refresh_expires_in);
    const data: SessionResponse = {
      access_token: session.access_token,
      expires_in: session.expires_in,
      token_type: 'Bearer',
      user: session.user,
    };
    await Reply.send(req, reply, AuthRefreshed({ payload: { user_id: session.user.id } }), data);
  } catch (error) {
    Cookies.clear(reply);
    throw AuthRefreshError({ cause: error, metadata: { route: 'auth.controller.refresh' } });
  }
};
