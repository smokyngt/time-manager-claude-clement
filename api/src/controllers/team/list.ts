import { TeamListError } from '@/lib/errors/index.js';
import { TeamListed } from '@/lib/events/index.js';
import { RequestLimits } from '@/schemas/index.js';
import { teamService } from '@/services/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';
import { Time } from '@/utils/time.js';

import type { ListTeamsBody, ListTeamsResponse } from './index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route team.controller.list
 * @param {FastifyRequest<{ Body: ListTeamsBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<ListTeamsResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {TeamListError | UnauthorizedError}
 */
export const list = async (
  req: FastifyRequest<{ Body: ListTeamsBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<ListTeamsResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    Access.team.require(actor, 'list');
    const {
      archived,
      cursor,
      ids,
      limit,
      manager_id: managerId,
      member_id: memberId,
      order,
    } = req.body;
    const result = await teamService.list({
      cursor,
      filters: {
        archived,
        created_after: Time.bound(req.body.created_after),
        created_before: Time.bound(req.body.created_before),
        ids,
        manager_id: managerId,
        member_id: memberId,
        visible_to:
          actor.role === 'admin' ? undefined : { id: actor.id, managed: actor.role === 'manager' },
      },
      limit: limit ?? RequestLimits.limitDefault,
      order: order ?? 'desc',
    });
    await Reply.send(
      req,
      reply,
      TeamListed({ payload: { actor: actor.id, count: result.items.length, total: result.total } }),
      result,
    );
  } catch (error) {
    throw TeamListError({ cause: error, metadata: { route: 'team.controller.list' } });
  }
};
