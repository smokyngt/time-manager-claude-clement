import { TeamMemberAddError, ValidationError  } from '@/lib/errors/index.js';
import { TeamMembersAdded } from '@/lib/events/index.js';
import { RequestLimits } from '@/schemas/index.js';
import { teamMemberService } from '@/services/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { AddTeamMembersBody, AddTeamMembersParams, AddTeamMembersResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team.member.controller.add
 * @param {FastifyRequest<{ Body: AddTeamMembersBody; Params: AddTeamMembersParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<AddTeamMembersResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {ValidationError | UnauthorizedError | TeamMemberAddError}
 */
export const add = async (
  req: FastifyRequest<{ Body: AddTeamMembersBody; Params: AddTeamMembersParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<AddTeamMembersResponse> }>,
): Promise<void> => {
  try {
    const actor = Access.role.require(req, ['admin', 'manager']);
    const userIds = [...new Set(req.body.user_ids)];
    if (userIds.length === 0 || userIds.length > RequestLimits.bulk) {
      throw ValidationError({
        metadata: { field: 'user_ids', route: 'team.member.controller.add' },
      });
    }
    const { team } = await teamMemberService.team({ id: req.params.id });
    Access.teamMember.manage(actor, team);
    const result = await teamMemberService.add({
      actor,
      roles: Access.teamMember.roles(actor),
      team,
      user_ids: userIds,
    });
    await Reply.send(
      req,
      reply,
      TeamMembersAdded({
        payload: {
          actor: actor.id,
          added: result.added.length,
          failed: result.failed.length,
          team_id: team.id,
        },
      }),
      result,
    );
  } catch (error) {
    throw TeamMemberAddError({
      cause: error,
      metadata: { route: 'team.member.controller.add' },
    });
  }
};
