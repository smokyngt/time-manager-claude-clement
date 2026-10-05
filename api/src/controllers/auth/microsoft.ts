import { Cookies } from '@/lib/auth/cookies.js';
import { AuthMicrosoftError } from '@/lib/errors/index.js';
import { AuthMicrosoftStarted } from '@/lib/events/index.js';
import { authService } from '@/services/index.js';

import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route auth.controller.microsoft
 * @param {FastifyRequest} req
 * @param {FastifyReply} reply
 * @returns {Promise<void>}
 * @throws {AuthMicrosoftError}
 */
export const microsoft = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
  try {
    const result = await authService.authorize();
    reply.setCookie(
      Cookies.oauth,
      result.state_cookie,
      Cookies.options(result.max_age, '/v1/auth/microsoft'),
    );
    req.log.info(
      { correlation_id: req.id, event: AuthMicrosoftStarted.code },
      'request succeeded',
    );
    await reply.redirect(result.url);
  } catch (error) {
    throw AuthMicrosoftError({ cause: error, metadata: { route: 'auth.controller.microsoft' } });
  }
};
