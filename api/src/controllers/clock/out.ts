import { ClockOutError } from '@/lib/errors/domains/clock.js';
import { ClockOut } from '@/lib/events/domains/clock.js';
import { clockService } from '@/services/clock/index.js';
import { Access } from '@/utils/access.js';
import { Reply } from '@/utils/reply.js';

import type { OutBody } from './index.js';
import type { Clock } from '@/types/entities/clock.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route clock.controller.out
 * @param {FastifyRequest<{ Body: OutBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<Clock> }>} reply
 * @returns {Promise<void>}
 * @throws {ClockOutError}
 */
export const clockOut = async (
  req: FastifyRequest<{ Body: OutBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<Clock> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { clock } = await clockService.out({ actor, note: req.body.note });
    await Reply.send(req, reply, ClockOut({ payload: { clock_id: clock.id } }), clock);
  } catch (error) {
    throw ClockOutError({ cause: error, metadata: { route: 'clock.controller.out' } });
  }
};
