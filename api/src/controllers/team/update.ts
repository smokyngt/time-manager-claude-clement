import { InternalError, UnauthorizedError, ValidationError } from '@/lib/errors/base/core.js';
import { AppError } from '@/lib/errors/base/registry.js';
import { TeamNotFoundError, TeamUpdateError } from '@/lib/errors/domains/team.js';
import { TeamUpdated } from '@/lib/events/domains/team.js';
import { RequestLimits } from '@/schemas/common.js';
import { teamService } from '@/services/team/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { BulkFailure, UpdateBody, UpdateResponse } from './index.js';
import type { Team } from '@/types/entities/team.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team.controller.update
 * @param {FastifyRequest<{ Body: UpdateBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<UpdateResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {TeamUpdateError | UnauthorizedError | ValidationError}
 */
export const update = async (
  req: FastifyRequest<{ Body: UpdateBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<UpdateResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
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
      if (!(await Access.team.scope(actor, item.team))) {
        failed.push({ code: TeamNotFoundError.code, id: item.id });
        continue;
      }
      Access.team.require(actor, 'update', item.team);
      const allowed = Access.team.fields(actor, item.team);
      if (!keys.every((key) => allowed.includes(key))) {
        throw UnauthorizedError({
          metadata: { route: 'team.controller.update', team_id: item.id },
        });
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
      TeamUpdated({
        payload: { actor: actor.id, failed: failed.length, updated: updated.length },
      }),
      result,
    );
  } catch (error) {
    throw TeamUpdateError({ cause: error, metadata: { route: 'team.controller.update' } });
  }
};
