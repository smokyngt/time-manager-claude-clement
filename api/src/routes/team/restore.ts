import { team } from '@/controllers/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { TeamIdParamsSchema, TeamResponses } from '@/schemas/index.js';

import type { RestoreTeamParams, TeamResponse } from '@/controllers/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const restore: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: RestoreTeamParams; Reply: ReplyEnvelope<TeamResponse> }>(
    '/:id/restore',
    {
      preHandler: auth({ scopes: ['teams:manage'] }),
      schema: {
        description:
          'Restore an archived team. Admins can restore any team, managers the teams they manage.',
        params: TeamIdParamsSchema,
        response: TeamResponses.restore,
        security: [{ bearerAuth: [] }],
        summary: 'Restore a team',
        tags: ['teams'],
      },
    },
    team.restore,
  );
};

export { restore };
