import { Cookies } from '@/lib/auth/cookies.js';
import { AuthLogoutError } from '@/lib/errors/domains/auth.js';
import { AuthLoggedOut } from '@/lib/events/domains/auth.js';
import { authService } from '@/services/auth/index.js';
import { Access } from '@/utils/access.js';
import { Reply } from '@/utils/reply.js';

import type { LogoutResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route auth.controller.logout
 * @param {FastifyRequest} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<LogoutResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {AuthLogoutError}
 */
export const logout = async (
  req: FastifyRequest,
  reply: FastifyReply<{ Reply: ReplyEnvelope<LogoutResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const result = await authService.logout({ actor, token: req.cookies[Cookies.refresh] });
    Cookies.clear(reply);
    await Reply.send(req, reply, AuthLoggedOut({ payload: { user_id: actor.id } }), result);
  } catch (error) {
    throw AuthLogoutError({ cause: error, metadata: { route: 'auth.controller.logout' } });
  }
};
