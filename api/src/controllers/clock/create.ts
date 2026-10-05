import { ClockCreateError } from '@/lib/errors/domains/clock.js';
import { ClockCreated } from '@/lib/events/domains/clock.js';
import { clockService } from '@/services/clock/index.js';
import { Access } from '@/utils/access.js';
import { clockAccess } from '@/utils/access/clock.js';
import { Reply } from '@/utils/reply.js';

import type { CreateBody } from './index.js';
import type { Clock } from '@/types/entities/clock.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route clock.controller.create
 * @param {FastifyRequest<{ Body: CreateBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<Clock> }>} reply
 * @returns {Promise<void>}
 * @throws {ClockCreateError}
 */
export const create = async (
  req: FastifyRequest<{ Body: CreateBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<Clock> }>,
): Promise<void> => {
  try {
    const actor = Access.role.require(req, ['admin', 'manager']);
    await clockAccess.require(actor, 'create', { user_id: req.body.user_id });
    const { clock } = await clockService.create({ actor, data: req.body });
    await Reply.send(req, reply, ClockCreated({ payload: { clock_id: clock.id } }), clock);
  } catch (error) {
    throw ClockCreateError({ cause: error, metadata: { route: 'clock.controller.create' } });
  }
};
