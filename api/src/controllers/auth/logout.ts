import { Cookies } from '@/lib/auth/cookies.js';
import { AuthLoggedOut } from '@/lib/events/domains/auth.js';
import { authService } from '@/services/auth/index.js';
import { Reply } from '@/utils/http/reply.js';

import type { LogoutResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route auth.controller.logout
 * @param {FastifyRequest} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<LogoutResponse> }>} reply
 * @returns {Promise<void>}
 */
export const logout = async (
  req: FastifyRequest,
  reply: FastifyReply<{ Reply: ReplyEnvelope<LogoutResponse> }>,
): Promise<void> => {
  const result = await authService.logout({ token: req.cookies[Cookies.refresh] }).catch(
    (error: unknown) => {
      req.log.warn({ error, route: 'auth.controller.logout' }, 'logout revocation failed');

      return { success: true, user_id: undefined };
    },
  );
  Cookies.clear(reply);
  const payload = result.user_id === undefined ? {} : { actor: result.user_id };
  await Reply.send(req, reply, AuthLoggedOut({ payload }), { success: true });
};
