import type { AppEvent } from '@/lib/events/index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
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
    req.log.info(
      { actor_id: req.actor?.id, event: event.code, payload: event.payload },
      'request succeeded',
    );
    await reply.status(200).send({ data, event: event.code });
  }
}
