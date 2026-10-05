import type { FastifyReply, FastifyRequest } from 'fastify';

import { Config } from '@/config/index.js';
import { Cookies } from '@/lib/auth/cookies.js';
import {
  AuthMicrosoftError,
  AuthMicrosoftRejectedError,
  AuthMicrosoftUnavailableError,
} from '@/lib/errors/domains/auth.js';
import { AuthMicrosoftLinked } from '@/lib/events/domains/auth.js';
import { AppError } from '@/lib/errors/index.js';
import { authService } from '@/services/auth/index.js';

import type { CallbackQuery } from './index.js';

/**
 * @route auth.controller.callback
 * @param {FastifyRequest<{ Querystring: CallbackQuery }>} req
 * @param {FastifyReply} reply
 * @returns {Promise<void>}
 * @throws {AuthMicrosoftError}
 */
export const callback = async (
  req: FastifyRequest<{ Querystring: CallbackQuery }>,
  reply: FastifyReply,
): Promise<void> => {
  const web = Config.store.text('WEB_URL', 'http://localhost:5173').replace(/\/+$/, '');
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
      { event: AuthMicrosoftLinked.code, user_id: session.user.id },
      'request succeeded',
    );
    await reply.redirect(`${web}/auth/callback`);
  } catch (error) {
    const wrapped = AuthMicrosoftError({
      cause: error,
      metadata: { route: 'auth.controller.callback' },
    });
    if (wrapped.code === AuthMicrosoftUnavailableError.code) throw wrapped;
    req.log.warn({ code: wrapped.code }, 'microsoft sign-in rejected');
    const code = AppError.is(wrapped) ? wrapped.code : AuthMicrosoftError.code;
    await reply.redirect(`${web}/auth/callback?error=${encodeURIComponent(code)}`);
  }
};
