import { TeamMemberListError } from '@/lib/errors/index.js';
import { TeamMembersListed } from '@/lib/events/index.js';
import { RequestLimits } from '@/schemas/index.js';
import { teamMemberService } from '@/services/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { ListTeamMembersBody, ListTeamMembersParams, ListTeamMembersResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team.member.controller.list
 * @param {FastifyRequest<{ Body: ListTeamMembersBody; Params: ListTeamMembersParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<ListTeamMembersResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {UnauthorizedError | TeamMemberListError}
 */
export const list = async (
  req: FastifyRequest<{ Body: ListTeamMembersBody; Params: ListTeamMembersParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<ListTeamMembersResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { cursor, limit, order } = req.body;
    const { team } = await teamMemberService.team({ id: req.params.id });
    await Access.teamMember.view(actor, team);
    const result = await teamMemberService.list({
      cursor,
      id: team.id,
      limit: limit ?? RequestLimits.limitDefault,
      order: order ?? 'desc',
    });
    await Reply.send(
      req,
      reply,
      TeamMembersListed({
        payload: {
          actor: actor.id,
          count: result.items.length,
          team_id: team.id,
          total: result.total,
        },
      }),
      result,
    );
  } catch (error) {
    throw TeamMemberListError({
      cause: error,
      metadata: { route: 'team.member.controller.list' },
    });
  }
};
