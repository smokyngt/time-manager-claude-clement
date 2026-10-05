import { ClockCreateError } from '@/lib/errors/domains/clock.js';
import { ClockCreated } from '@/lib/events/domains/clock.js';
import { clockService } from '@/services/clock/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { ClockResponse, CreateBody } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route clock.controller.create
 * @param {FastifyRequest<{ Body: CreateBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<ClockResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {ClockCreateError | UnauthorizedError}
 */
export const create = async (
  req: FastifyRequest<{ Body: CreateBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<ClockResponse> }>,
): Promise<void> => {
  try {
    const actor = Access.role.require(req, ['admin', 'manager']);
    await Access.clock.require(actor, 'create', { user_id: req.body.user_id });
    const { clock } = await clockService.create({ actor, data: req.body });
    await Reply.send(req, reply, ClockCreated({ payload: { actor: actor.id, clock_id: clock.id } }), {
      clock,
    });
  } catch (error) {
    throw ClockCreateError({ cause: error, metadata: { route: 'clock.controller.create' } });
  }
};
