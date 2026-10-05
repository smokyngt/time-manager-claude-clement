import { InternalError, ValidationError } from '@/lib/errors/base/core.js';
import { AppError } from '@/lib/errors/base/registry.js';
import { ClockNotFoundError, ClockDeleteError } from '@/lib/errors/domains/clock.js';
import { ClockDeleted } from '@/lib/events/domains/clock.js';
import { RequestLimits } from '@/schemas/common.js';
import { clockService } from '@/services/clock/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { BulkFailure, DeleteBody, DeleteResponse } from './index.js';
import type { Clock } from '@/types/entities/clock.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route clock.controller.delete
 * @param {FastifyRequest<{ Body: DeleteBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<DeleteResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {ClockDeleteError | UnauthorizedError | ValidationError}
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
    const result: DeleteResponse = { failed, success: failed.length === 0, deleted };
    await Reply.send(
      req,
      reply,
      ClockDeleted({
        payload: { actor: actor.id, failed: failed.length, deleted: deleted.length },
      }),
      result,
    );
  } catch (error) {
    throw ClockDeleteError({ cause: error, metadata: { route: 'clock.controller.delete' } });
  }
};
