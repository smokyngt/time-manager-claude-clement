import { AuthMeError } from '@/lib/errors/domains/auth.js';
import { AuthRetrieved } from '@/lib/events/domains/auth.js';
import { authService } from '@/services/auth/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { MeResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route auth.controller.me
 * @param {FastifyRequest} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<MeResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {AuthMeError}
 */
export const me = async (
  req: FastifyRequest,
  reply: FastifyReply<{ Reply: ReplyEnvelope<MeResponse> }>,
): Promise<void> => {
  try {
    const { actor, scopes } = Access.context(req);
    const { user } = await authService.me({ actor });
    await Reply.send(req, reply, AuthRetrieved({ payload: { actor: actor.id } }), {
      scopes: [...scopes],
      user,
    });
  } catch (error) {
    throw AuthMeError({ cause: error, metadata: { route: 'auth.controller.me' } });
  }
};
