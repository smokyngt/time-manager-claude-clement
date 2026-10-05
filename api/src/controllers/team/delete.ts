import { TeamDeleteError } from '@/lib/errors/domains/team.js';
import { AppError, InternalError, ValidationError } from '@/lib/errors/index.js';
import { TeamDeleted } from '@/lib/events/domains/team.js';
import { RequestLimits } from '@/schemas/common.js';
import { teamService } from '@/services/team/index.js';
import { Access } from '@/utils/access.js';
import { teamAccess } from '@/utils/access/team.js';
import { Reply } from '@/utils/reply.js';

import type { BulkFailure, DeleteBody, DeleteResponse } from './index.js';
import type { Team } from '@/types/entities/team.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team.controller.delete
 * @param {FastifyRequest<{ Body: DeleteBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<DeleteResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {TeamDeleteError}
 */
export const remove = async (
  req: FastifyRequest<{ Body: DeleteBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<DeleteResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const ids = [...new Set(req.body.ids)];
    if (ids.length === 0 || ids.length > RequestLimits.bulk) {
      throw ValidationError({ metadata: { field: 'ids', route: 'team.controller.delete' } });
    }
    const failed: BulkFailure[] = [];
    const targets: Team[] = [];
    const loaded = await Promise.all(
      ids.map((id) =>
        teamService.retrieve({ id }).then(
          ({ team }) => ({ id, team }),
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
      teamAccess.require(actor, 'delete', item.team);
      targets.push(item.team);
    }
    const deleted: string[] = [];
    await Promise.all(
      targets.map(async (target) => {
        try {
          await teamService.delete({ actor, id: target.id });
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
      TeamDeleted({ payload: { deleted: deleted.length, failed: failed.length } }),
      result,
    );
  } catch (error) {
    throw TeamDeleteError({ cause: error, metadata: { route: 'team.controller.delete' } });
  }
};
