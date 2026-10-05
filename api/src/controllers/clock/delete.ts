import { ClockDeleteError } from '@/lib/errors/domains/clock.js';
import { AppError, InternalError, ValidationError } from '@/lib/errors/index.js';
import { ClockDeleted } from '@/lib/events/domains/clock.js';
import { RequestLimits } from '@/schemas/common.js';
import { clockService } from '@/services/clock/index.js';
import { Access } from '@/utils/access.js';
import { clockAccess } from '@/utils/access/clock.js';
import { Reply } from '@/utils/reply.js';

import type { BulkFailure, DeleteBody, DeleteResponse } from './index.js';
import type { Clock } from '@/types/entities/clock.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route clock.controller.delete
 * @param {FastifyRequest<{ Body: DeleteBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<DeleteResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {ClockDeleteError}
 */
export const remove = async (
  req: FastifyRequest<{ Body: DeleteBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<DeleteResponse> }>,
): Promise<void> => {
  try {
    const actor = Access.role.require(req, ['admin', 'manager']);
    const ids = [...new Set(req.body.ids)];
    if (ids.length === 0 || ids.length > RequestLimits.bulk) {
      throw ValidationError({ metadata: { field: 'ids', route: 'clock.controller.delete' } });
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
      await clockAccess.require(actor, 'delete', item.clock);
      targets.push(item.clock);
    }
    const deleted: string[] = [];
    await Promise.all(
      targets.map(async (target) => {
        try {
          await clockService.delete({ actor, id: target.id });
          deleted.push(target.id);
        } catch (error) {
          failed.push({
            code: AppError.is(error) ? error.code : InternalError.code,
            id: target.id,
          });
        }
      }),
    );
    const result: DeleteResponse = { deleted, failed, success: failed.length === 0 };
    await Reply.send(
      req,
      reply,
      ClockDeleted({ payload: { deleted: deleted.length, failed: failed.length } }),
      result,
    );
  } catch (error) {
    throw ClockDeleteError({ cause: error, metadata: { route: 'clock.controller.delete' } });
  }
};
