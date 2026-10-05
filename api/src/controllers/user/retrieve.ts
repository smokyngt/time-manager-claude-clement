import { UserRetrieveError } from '@/lib/errors/domains/user.js';
import { ForbiddenError } from '@/lib/errors/index.js';
import { UserRetrieved } from '@/lib/events/domains/user.js';
import { userService } from '@/services/user/index.js';
import { Access } from '@/utils/access.js';
import { Reply } from '@/utils/reply.js';

import type { RetrieveParams } from './index.js';
import type { User } from '@/types/entities/user.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route user.controller.retrieve
 * @param {FastifyRequest<{ Params: RetrieveParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<User> }>} reply
 * @returns {Promise<void>}
 * @throws {UserRetrieveError}
 */
export const retrieve = async (
  req: FastifyRequest<{ Params: RetrieveParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<User> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { id } = req.params;
    if (!Access.user.reach(actor, id)) {
      throw ForbiddenError({ metadata: { route: 'user.controller.retrieve' } });
    }
    const { user } = await userService.retrieve({ id });
    Access.user.require(actor, 'read', user);
    await Reply.send(req, reply, UserRetrieved({ payload: { user_id: user.id } }), user);
  } catch (error) {
    throw UserRetrieveError({ cause: error, metadata: { route: 'user.controller.retrieve' } });
  }
};
