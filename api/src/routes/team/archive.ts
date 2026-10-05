import { teamController } from '@/controllers/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { TeamIdParamsSchema, TeamResponses } from '@/schemas/index.js';

import type { ArchiveTeamParams, TeamResponse } from '@/controllers/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const archive: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: ArchiveTeamParams; Reply: ReplyEnvelope<TeamResponse> }>(
    '/:id/archive',
    {
      preHandler: auth({ scopes: ['teams:manage'] }),
      schema: {
        description:
          'Archive a team. Admins can archive any team, managers the teams they manage.',
        params: TeamIdParamsSchema,
        response: TeamResponses.archive,
        security: [{ bearerAuth: [] }],
        summary: 'Archive a team',
        tags: ['teams'],
      },
    },
    teamController.archive,
  );
};

export { archive };
