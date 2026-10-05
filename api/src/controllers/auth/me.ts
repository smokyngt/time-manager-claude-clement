import type { FastifyReply, FastifyRequest } from 'fastify';

import { AuthMeError } from '@/lib/errors/domains/auth.js';
import { AuthRetrieved } from '@/lib/events/domains/auth.js';
import { authService } from '@/services/auth/index.js';
import { Access } from '@/utils/access.js';
import { Reply } from '@/utils/reply.js';

import type { ReplyEnvelope } from '@/types/envelope.js';
import type { User } from '@/types/entities/user.js';

/**
 * @route auth.controller.me
 * @param {FastifyRequest} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<User> }>} reply
 * @returns {Promise<void>}
 * @throws {AuthMeError}
 */
export const me = async (
  req: FastifyRequest,
  reply: FastifyReply<{ Reply: ReplyEnvelope<User> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { user } = await authService.me({ actor });
    await Reply.send(req, reply, AuthRetrieved({ payload: { user_id: user.id } }), user);
  } catch (error) {
    throw AuthMeError({ cause: error, metadata: { route: 'auth.controller.me' } });
  }
};
