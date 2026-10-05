import { Metrics } from '@/lib/telemetry/metrics.js';

import type { AppEvent } from '@/lib/events/base/registry.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

export class Reply {
  /**
   * @route reply.send
   * @param {FastifyRequest} req
   * @param {FastifyReply} reply
   * @param {AppEvent<Payload>} event
   * @param {Data} data
   * @returns {Promise<void>}
   */
  public static async send<Data, Payload>(
    req: FastifyRequest,
    reply: FastifyReply<{ Reply: ReplyEnvelope<Data> }>,
    event: AppEvent<Payload>,
    data: Data,
  ): Promise<void> {
    const body: ReplyEnvelope<Data> = {
      data,
      event: {
        code: event.code,
        correlation_id: req.id,
        metadata: event.metadata,
        payload: event.payload,
      },
      timestamp: Date.now(),
    };
    Metrics.event(event.code);
    req.log.info(
      {
        actor_id: req.requestContext.get('user')?.id,
        correlation_id: req.id,
        event: event.code,
      },
      'request succeeded',
    );
    await reply.status(200).send(body);
  }
}
