import { InternalError, ValidationError } from '@/lib/errors/index.js';
import { AppError } from '@/lib/errors/index.js';
import { ClockNotFoundError, ClockUpdateError } from '@/lib/errors/index.js';
import { ClockUpdated } from '@/lib/events/index.js';
import { RequestLimits } from '@/schemas/index.js';
import { clockService } from '@/services/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { BulkFailure, UpdateClocksBody, UpdateClocksResponse } from './index.js';
import type { Clock } from '@/types/entities/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route clock.controller.update
 * @param {FastifyRequest<{ Body: UpdateClocksBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<UpdateClocksResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {ClockUpdateError | UnauthorizedError | ValidationError}
 */
export const update = async (
  req: FastifyRequest<{ Body: UpdateClocksBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<UpdateClocksResponse> }>,
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
      if (!(await Access.clock.scope(actor, item.clock))) {
        failed.push({ code: ClockNotFoundError.code, id: item.id });
        continue;
      }
      await Access.clock.require(actor, 'update', item.clock);
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
    const result: UpdateClocksResponse = { failed, success: failed.length === 0, updated };
    await Reply.send(
      req,
      reply,
      ClockUpdated({
        payload: { actor: actor.id, failed: failed.length, updated: updated.length },
      }),
      result,
    );
  } catch (error) {
    throw ClockUpdateError({ cause: error, metadata: { route: 'clock.controller.update' } });
  }
};
