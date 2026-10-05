import { UnauthorizedError } from '@/lib/errors/index.js';
import { UserNotFoundError, UserRetrieveError } from '@/lib/errors/index.js';
import { UserRetrieved } from '@/lib/events/index.js';
import { userService } from '@/services/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { RetrieveUserParams, UserResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route user.controller.retrieve
 * @param {FastifyRequest<{ Params: RetrieveUserParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<UserResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {UnauthorizedError | UserNotFoundError | UserRetrieveError}
 */
export const retrieve = async (
  req: FastifyRequest<{ Params: RetrieveUserParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<UserResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { id } = req.params;
    if (!Access.user.reach(actor, id)) {
      throw UnauthorizedError({ metadata: { route: 'user.controller.retrieve', user_id: id } });
    }
    const { user } = await userService.retrieve({ id });
    if (!(await Access.user.scope(actor, user))) {
      throw UserNotFoundError({ metadata: { route: 'user.controller.retrieve', user_id: id } });
    }
    Access.user.require(actor, 'read', user);
    await Reply.send(req, reply, UserRetrieved({ payload: { actor: actor.id, user_id: user.id } }), {
      user,
    });
  } catch (error) {
    throw UserRetrieveError({ cause: error, metadata: { route: 'user.controller.retrieve' } });
  }
};
