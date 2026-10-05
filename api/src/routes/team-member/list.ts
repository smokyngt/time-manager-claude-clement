import { teamMemberController } from '@/controllers/index.js';
import { auth } from '@/middlewares/auth/index.js';
import {
  TeamMemberIdParamsSchema,
  TeamMemberListBodySchema,
  TeamMemberResponses,
} from '@/schemas/index.js';

import type { ListTeamMembersBody, ListTeamMembersParams, ListTeamMembersResponse } from '@/controllers/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const list: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: ListTeamMembersBody; Params: ListTeamMembersParams; Reply: ReplyEnvelope<ListTeamMembersResponse> }>(
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
        tags: ['team-members'],
      },
    },
    teamMemberController.list,
  );
};

export { list };
