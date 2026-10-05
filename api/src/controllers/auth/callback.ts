import { Config } from '@/config/index.js';
import { Cookies } from '@/lib/auth/cookies.js';
import {
  AuthMicrosoftError,
  AuthMicrosoftRejectedError,
  AuthMicrosoftUnavailableError,
} from '@/lib/errors/index.js';
import { AuthLoggedIn } from '@/lib/events/index.js';
import { authService } from '@/services/index.js';

import type { AuthCallbackQuery } from './index.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route auth.controller.callback
 * @param {FastifyRequest<{ Querystring: AuthCallbackQuery }>} req
 * @param {FastifyReply} reply
 * @returns {Promise<void>}
 * @throws {AuthMicrosoftUnavailableError}
 */
export const callback = async (
  req: FastifyRequest<{ Querystring: AuthCallbackQuery }>,
  reply: FastifyReply,
): Promise<void> => {
  const web = Config.web();
  try {
    const { code, error: denied, state } = req.query;
    reply.clearCookie(Cookies.oauth, Cookies.options(0, '/v1/auth/microsoft'));
    if (denied !== undefined || code === undefined || state === undefined) {
      throw AuthMicrosoftRejectedError({ metadata: { route: 'auth.controller.callback' } });
    }
    const session = await authService.callback({
      code,
      state,
      state_cookie: req.cookies[Cookies.oauth],
    });
    Cookies.set(reply, session.refresh_token, session.refresh_expires_in);
    req.log.info(
      { actor_id: session.user.id, correlation_id: req.id, event: AuthLoggedIn.code },
      'request succeeded',
    );
    await reply.redirect(`${web}/auth/callback`);
  } catch (error) {
    const wrapped = AuthMicrosoftError({
      cause: error,
      metadata: { route: 'auth.controller.callback' },
    });
    if (wrapped.code === AuthMicrosoftUnavailableError.code) throw wrapped;
    req.log.warn({ code: wrapped.code, correlation_id: req.id }, 'microsoft sign-in rejected');
    await reply.redirect(`${web}/auth/callback?error=${encodeURIComponent(wrapped.code)}`);
  }
};
