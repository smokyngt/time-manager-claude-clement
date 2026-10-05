import { Roles } from '@/config/auth/roles.js';
import { Cookies } from '@/lib/auth/cookies.js';
import { AuthLoginError } from '@/lib/errors/index.js';
import { AuthLoggedIn } from '@/lib/events/index.js';
import { authService } from '@/services/index.js';
import { Reply } from '@/utils/http/reply.js';

import type { AuthLoginBody, AuthSessionResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route auth.controller.login
 * @param {FastifyRequest<{ Body: AuthLoginBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<AuthSessionResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {AuthLoginError}
 */
export const login = async (
  req: FastifyRequest<{ Body: AuthLoginBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<AuthSessionResponse> }>,
): Promise<void> => {
  try {
    const { email, password } = req.body;
    const session = await authService.login({ email, password });
    Cookies.set(reply, session.refresh_token, session.refresh_expires_in);
    await Reply.send(req, reply, AuthLoggedIn({ payload: { actor: session.user.id } }), {
      access_token: session.access_token,
      expires_in: session.expires_in,
      scopes: [...Roles.scopes(session.user.role)],
      token_type: 'Bearer',
      user: session.user,
    });
  } catch (error) {
    throw AuthLoginError({ cause: error, metadata: { route: 'auth.controller.login' } });
  }
};
