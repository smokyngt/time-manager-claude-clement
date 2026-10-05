import { TeamMemberListError } from '@/lib/errors/domains/team-member.js';
import { TeamMembersListed } from '@/lib/events/domains/team-member.js';
import { RequestLimits } from '@/schemas/common.js';
import { teamMemberService } from '@/services/team-member/index.js';
import { Access } from '@/utils/access.js';
import { Reply } from '@/utils/reply.js';

import type { ListBody, ListParams, ListResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team_member.controller.list
 * @param {FastifyRequest<{ Body: ListBody; Params: ListParams }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<ListResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {TeamMemberListError}
 */
export const list = async (
  req: FastifyRequest<{ Body: ListBody; Params: ListParams }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<ListResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { cursor, limit, order } = req.body;
    const result = await teamMemberService.list({
      actor,
      cursor,
      id: req.params.id,
      limit: limit ?? RequestLimits.limitDefault,
      order: order ?? 'desc',
    });
    await Reply.send(
      req,
      reply,
      TeamMembersListed({ payload: { count: result.items.length, total: result.total } }),
      result,
    );
  } catch (error) {
    throw TeamMemberListError({
      cause: error,
      metadata: { route: 'team_member.controller.list' },
    });
  }
};
