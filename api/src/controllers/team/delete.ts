import { AppError, InternalError, TeamDeleteError , TeamNotFoundError, ValidationError  } from '@/lib/errors/index.js';
import { TeamDeleted } from '@/lib/events/index.js';
import { RequestLimits } from '@/schemas/index.js';
import { teamService } from '@/services/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { DeleteTeamsBody, DeleteTeamsResponse } from './index.js';
import type { BulkFailure, Team } from '@/types/entities/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team.controller.delete
 * @param {FastifyRequest<{ Body: DeleteTeamsBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<DeleteTeamsResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {TeamDeleteError | UnauthorizedError | ValidationError}
 */
export const remove = async (
  req: FastifyRequest<{ Body: DeleteTeamsBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<DeleteTeamsResponse> }>,
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
      if (!(await Access.team.scope(actor, item.team))) {
        failed.push({ code: TeamNotFoundError.code, id: item.id });
        continue;
      }
      Access.team.require(actor, 'delete', item.team);
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
    const result: DeleteTeamsResponse = { deleted, failed, success: failed.length === 0 };
    await Reply.send(
      req,
      reply,
      TeamDeleted({
        payload: { actor: actor.id, deleted: deleted.length, failed: failed.length },
      }),
      result,
    );
  } catch (error) {
    throw TeamDeleteError({ cause: error, metadata: { route: 'team.controller.delete' } });
  }
};
