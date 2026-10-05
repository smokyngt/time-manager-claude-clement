import { teamMember } from '@/controllers/team-member/index.js';
import { auth } from '@/plugins/auth.js';
import {
  TeamMemberIdParamsSchema,
  TeamMemberListBodySchema,
  TeamMemberResponses,
} from '@/schemas/team-member.js';

import type { ListBody, ListParams, ListResponse } from '@/controllers/team-member/index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const listRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: ListBody; Params: ListParams; Reply: ReplyEnvelope<ListResponse> }>(
    '/:id/members/list',
    {
      preHandler: auth({ scopes: ['teams:read'] }),
      schema: {
        body: TeamMemberListBodySchema,
        description:
          'Cursor paginated list of the members of a team ordered by creation time. Admins, the manager of the team and its members.',
        params: TeamMemberIdParamsSchema,
        response: TeamMemberResponses.list,
        security: [{ bearerAuth: [] }],
        summary: 'List team members',
        tags: ['teams'],
      },
    },
    teamMember.list,
  );
};
