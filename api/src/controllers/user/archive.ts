import { UserArchiveError } from '@/lib/errors/domains/user.js';
import { ForbiddenError } from '@/lib/errors/index.js';
import { UserArchived } from '@/lib/events/domains/user.js';
import { userService } from '@/services/user/index.js';
import { Access } from '@/utils/access.js';
import { Reply } from '@/utils/reply.js';

import type { ArchiveParams } from './index.js';
import type { User } from '@/types/entities/user.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route user.controller.archive
 * @param {FastifyRequest<{ Params: ArchiveParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<User> }>} reply
 * @returns {Promise<void>}
 * @throws {UserArchiveError}
 */
export const archive = async (
  req: FastifyRequest<{ Params: ArchiveParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<User> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { id } = req.params;
    if (!Access.user.reach(actor, id)) {
      throw ForbiddenError({ metadata: { route: 'user.controller.archive' } });
    }
    const { user: target } = await userService.retrieve({ id });
    Access.user.require(actor, 'archive', target);
    const { user } = await userService.archive({ actor, id });
    await Reply.send(req, reply, UserArchived({ payload: { user_id: user.id } }), user);
  } catch (error) {
    throw UserArchiveError({ cause: error, metadata: { route: 'user.controller.archive' } });
  }
};
