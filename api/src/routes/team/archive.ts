import { team } from '@/controllers/team/index.js';
import { auth } from '@/plugins/auth.js';
import { TeamIdParamsSchema, TeamResponses } from '@/schemas/team.js';

import type { ArchiveParams } from '@/controllers/team/index.js';
import type { Team } from '@/types/entities/team.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const archiveRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: ArchiveParams; Reply: ReplyEnvelope<Team> }>(
    '/:id/archive',
    {
      preHandler: auth({ scopes: ['teams:manage'] }),
      schema: {
        description:
          'Archive a team. Archived teams are ignored when resolving managers and memberships.',
        params: TeamIdParamsSchema,
        response: TeamResponses.archive,
        security: [{ bearerAuth: [] }],
        summary: 'Archive a team',
        tags: ['teams'],
      },
    },
    team.archive,
  );
};
