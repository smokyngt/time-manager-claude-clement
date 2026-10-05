import { ClockInError } from '@/lib/errors/domains/clock.js';
import { ClockIn } from '@/lib/events/domains/clock.js';
import { clockService } from '@/services/clock/index.js';
import { Access } from '@/utils/access.js';
import { Reply } from '@/utils/reply.js';

import type { InBody } from './index.js';
import type { Clock } from '@/types/entities/clock.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route clock.controller.in
 * @param {FastifyRequest<{ Body: InBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<Clock> }>} reply
 * @returns {Promise<void>}
 * @throws {ClockInError}
 */
export const clockIn = async (
  req: FastifyRequest<{ Body: InBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<Clock> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { clock } = await clockService.in({ actor, note: req.body.note });
    await Reply.send(req, reply, ClockIn({ payload: { clock_id: clock.id } }), clock);
  } catch (error) {
    throw ClockInError({ cause: error, metadata: { route: 'clock.controller.in' } });
  }
};
