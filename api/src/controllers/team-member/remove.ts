import { ValidationError } from '@/lib/errors/index.js';
import { TeamMemberRemoveError } from '@/lib/errors/index.js';
import { TeamMembersRemoved } from '@/lib/events/index.js';
import { RequestLimits } from '@/schemas/index.js';
import { teamMemberService } from '@/services/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { RemoveTeamMembersBody, RemoveTeamMembersParams, RemoveTeamMembersResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team.member.controller.remove
 * @param {FastifyRequest<{ Body: RemoveTeamMembersBody; Params: RemoveTeamMembersParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<RemoveTeamMembersResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {ValidationError | UnauthorizedError | TeamMemberRemoveError}
 */
export const remove = async (
  req: FastifyRequest<{ Body: RemoveTeamMembersBody; Params: RemoveTeamMembersParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<RemoveTeamMembersResponse> }>,
): Promise<void> => {
  try {
    const actor = Access.role.require(req, ['admin', 'manager']);
    const userIds = [...new Set(req.body.user_ids)];
    if (userIds.length === 0 || userIds.length > RequestLimits.bulk) {
      throw ValidationError({
        metadata: { field: 'user_ids', route: 'team.member.controller.remove' },
      });
    }
    const { team } = await teamMemberService.team({ id: req.params.id });
    Access.teamMember.manage(actor, team);
    const result = await teamMemberService.remove({ actor, id: team.id, user_ids: userIds });
    await Reply.send(
      req,
      reply,
      TeamMembersRemoved({
        payload: {
          actor: actor.id,
          failed: result.failed.length,
          removed: result.removed.length,
          team_id: team.id,
        },
      }),
      result,
    );
  } catch (error) {
    throw TeamMemberRemoveError({
      cause: error,
      metadata: { route: 'team.member.controller.remove' },
    });
  }
};
