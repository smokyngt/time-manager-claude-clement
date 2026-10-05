import type { FastifyReply, FastifyRequest } from 'fastify';

import { Cookies } from '@/lib/auth/cookies.js';
import { AuthLoginError } from '@/lib/errors/domains/auth.js';
import { AuthLoggedIn } from '@/lib/events/domains/auth.js';
import { authService } from '@/services/auth/index.js';
import { Reply } from '@/utils/reply.js';

import type { ReplyEnvelope } from '@/types/envelope.js';

import type { LoginBody, SessionResponse } from './index.js';

/**
 * @route auth.controller.login
 * @param {FastifyRequest<{ Body: LoginBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<SessionResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {AuthLoginError}
 */
export const login = async (
  req: FastifyRequest<{ Body: LoginBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<SessionResponse> }>,
): Promise<void> => {
  try {
    const { email, password } = req.body;
    const session = await authService.login({ email, password });
    Cookies.set(reply, session.refresh_token, session.refresh_expires_in);
    const data: SessionResponse = {
      access_token: session.access_token,
      expires_in: session.expires_in,
      token_type: 'Bearer',
      user: session.user,
    };
    await Reply.send(req, reply, AuthLoggedIn({ payload: { user_id: session.user.id } }), data);
  } catch (error) {
    throw AuthLoginError({ cause: error, metadata: { route: 'auth.controller.login' } });
  }
};
