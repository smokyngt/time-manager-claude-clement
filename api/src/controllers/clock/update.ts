import { ClockUpdateError } from '@/lib/errors/domains/clock.js';
import { AppError, InternalError, ValidationError } from '@/lib/errors/index.js';
import { ClockUpdated } from '@/lib/events/domains/clock.js';
import { RequestLimits } from '@/schemas/common.js';
import { clockService } from '@/services/clock/index.js';
import { Access } from '@/utils/access.js';
import { clockAccess } from '@/utils/access/clock.js';
import { Reply } from '@/utils/reply.js';

import type { BulkFailure, UpdateBody, UpdateResponse } from './index.js';
import type { Clock } from '@/types/entities/clock.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route clock.controller.update
 * @param {FastifyRequest<{ Body: UpdateBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<UpdateResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {ClockUpdateError}
 */
export const update = async (
  req: FastifyRequest<{ Body: UpdateBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<UpdateResponse> }>,
): Promise<void> => {
  try {
    const actor = Access.role.require(req, ['admin', 'manager']);
    const { data } = req.body;
    const ids = [...new Set(req.body.ids)];
    if (ids.length === 0 || ids.length > RequestLimits.bulk) {
      throw ValidationError({ metadata: { field: 'ids', route: 'clock.controller.update' } });
    }
    const failed: BulkFailure[] = [];
    const targets: Clock[] = [];
    const loaded = await Promise.all(
      ids.map((id) =>
        clockService.retrieve({ id }).then(
          ({ clock }) => ({ clock, id }),
          (error: unknown) => ({ error, id }),
        ),
      ),
    );
    for (const item of loaded) {
      if ('error' in item) {
        failed.push({
          code: AppError.is(item.error) ? item.error.code : InternalError.code,
          id: item.id,
        });
        continue;
      }
      await clockAccess.require(actor, 'update', item.clock);
      targets.push(item.clock);
    }
    const updated: string[] = [];
    await Promise.all(
      targets.map(async (target) => {
        try {
          await clockService.update({ actor, data, id: target.id });
          updated.push(target.id);
        } catch (error) {
          failed.push({
            code: AppError.is(error) ? error.code : InternalError.code,
            id: target.id,
          });
        }
      }),
    );
    const result: UpdateResponse = { failed, success: failed.length === 0, updated };
    await Reply.send(
      req,
      reply,
      ClockUpdated({ payload: { failed: failed.length, updated: updated.length } }),
      result,
    );
  } catch (error) {
    throw ClockUpdateError({ cause: error, metadata: { route: 'clock.controller.update' } });
  }
};
