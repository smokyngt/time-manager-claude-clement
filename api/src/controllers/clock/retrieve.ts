import { ClockRetrieveError } from '@/lib/errors/domains/clock.js';
import { ClockRetrieved } from '@/lib/events/domains/clock.js';
import { clockService } from '@/services/clock/index.js';
import { Access } from '@/utils/access.js';
import { clockAccess } from '@/utils/access/clock.js';
import { Reply } from '@/utils/reply.js';

import type { RetrieveParams } from './index.js';
import type { Clock } from '@/types/entities/clock.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route clock.controller.retrieve
 * @param {FastifyRequest<{ Params: RetrieveParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<Clock> }>} reply
 * @returns {Promise<void>}
 * @throws {ClockRetrieveError}
 */
export const retrieve = async (
  req: FastifyRequest<{ Params: RetrieveParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<Clock> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { clock } = await clockService.retrieve({ id: req.params.id });
    await clockAccess.require(actor, 'read', clock);
    await Reply.send(req, reply, ClockRetrieved({ payload: { clock_id: clock.id } }), clock);
  } catch (error) {
    throw ClockRetrieveError({ cause: error, metadata: { route: 'clock.controller.retrieve' } });
  }
};
