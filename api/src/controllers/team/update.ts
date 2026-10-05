import { TeamUpdateError } from '@/lib/errors/domains/team.js';
import { AppError, ForbiddenError, InternalError, ValidationError } from '@/lib/errors/index.js';
import { TeamUpdated } from '@/lib/events/domains/team.js';
import { RequestLimits } from '@/schemas/common.js';
import { teamService } from '@/services/team/index.js';
import { Access } from '@/utils/access.js';
import { teamAccess } from '@/utils/access/team.js';
import { Reply } from '@/utils/reply.js';

import type { BulkFailure, UpdateBody, UpdateResponse } from './index.js';
import type { Team } from '@/types/entities/team.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team.controller.update
 * @param {FastifyRequest<{ Body: UpdateBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<UpdateResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {TeamUpdateError}
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
      throw ValidationError({ metadata: { field: 'ids', route: 'team.controller.update' } });
    }
    const keys = Object.keys(data);
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
      teamAccess.require(actor, 'update', item.team);
      const allowed = teamAccess.fields(actor, item.team);
      if (!keys.every((key) => allowed.includes(key))) {
        throw ForbiddenError({ metadata: { route: 'team.controller.update' } });
      }
      targets.push(item.team);
    }
    const updated: string[] = [];
    await Promise.all(
      targets.map(async (target) => {
        try {
          await teamService.update({ actor, data, id: target.id });
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
      TeamUpdated({ payload: { failed: failed.length, updated: updated.length } }),
      result,
    );
  } catch (error) {
    throw TeamUpdateError({ cause: error, metadata: { route: 'team.controller.update' } });
  }
};
