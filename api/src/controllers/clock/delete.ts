import { InternalError, ValidationError } from '@/lib/errors/index.js';
import { AppError } from '@/lib/errors/index.js';
import { ClockDeleteError, ClockNotFoundError } from '@/lib/errors/index.js';
import { ClockDeleted } from '@/lib/events/index.js';
import { RequestLimits } from '@/schemas/index.js';
import { clockService } from '@/services/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { BulkFailure, DeleteClocksBody, DeleteClocksResponse } from './index.js';
import type { Clock } from '@/types/entities/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route clock.controller.delete
 * @param {FastifyRequest<{ Body: DeleteClocksBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<DeleteClocksResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {ClockDeleteError | UnauthorizedError | ValidationError}
 */
export const remove = async (
  req: FastifyRequest<{ Body: DeleteClocksBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<DeleteClocksResponse> }>,
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
      if (!(await Access.clock.scope(actor, item.clock))) {
        failed.push({ code: ClockNotFoundError.code, id: item.id });
        continue;
      }
      await Access.clock.require(actor, 'delete', item.clock);
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
    const result: DeleteClocksResponse = { deleted, failed, success: failed.length === 0 };
    await Reply.send(
      req,
      reply,
      ClockDeleted({
        payload: { actor: actor.id, deleted: deleted.length, failed: failed.length },
      }),
      result,
    );
  } catch (error) {
    throw ClockDeleteError({ cause: error, metadata: { route: 'clock.controller.delete' } });
  }
};
