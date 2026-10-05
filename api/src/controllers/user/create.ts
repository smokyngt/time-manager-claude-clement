import type { FastifyReply, FastifyRequest } from 'fastify';

import { UserCreated } from '@/lib/events/domains/user.js';
import { UserCreateError } from '@/lib/errors/domains/user.js';
import { userService } from '@/services/user/index.js';
import { Access } from '@/utils/access.js';
import { Reply } from '@/utils/reply.js';

import type { ReplyEnvelope } from '@/types/envelope.js';
import type { User } from '@/types/entities/user.js';

import type { CreateBody } from './index.js';

/**
 * @route user.controller.create
 * @param {FastifyRequest<{ Body: CreateBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<User> }>} reply
 * @returns {Promise<void>}
 * @throws {UserCreateError}
 */
export const create = async (
  req: FastifyRequest<{ Body: CreateBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<User> }>,
): Promise<void> => {
  try {
    const actor = Access.role.require(req, ['admin', 'manager']);
    Access.user.require(actor, 'create', { role: req.body.role ?? 'employee' });
    const { user } = await userService.create({ actor, data: req.body });
    await Reply.send(req, reply, UserCreated({ payload: { user_id: user.id } }), user);
  } catch (error) {
    throw UserCreateError({ cause: error, metadata: { route: 'user.controller.create' } });
  }
};
