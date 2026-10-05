import { team } from '@/controllers/team/index.js';
import { auth } from '@/plugins/auth.js';
import { TeamIdParamsSchema, TeamResponses } from '@/schemas/team.js';

import type { RestoreParams } from '@/controllers/team/index.js';
import type { Team } from '@/types/entities/team.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const restoreRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: RestoreParams; Reply: ReplyEnvelope<Team> }>(
    '/:id/restore',
    {
      preHandler: auth({ scopes: ['teams:manage'] }),
      schema: {
        description: 'Restore an archived team.',
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
