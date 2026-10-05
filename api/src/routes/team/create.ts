import { team } from '@/controllers/team/index.js';
import { auth } from '@/plugins/auth.js';
import { TeamCreateBodySchema, TeamResponses } from '@/schemas/team.js';

import type { CreateBody } from '@/controllers/team/index.js';
import type { Team } from '@/types/entities/team.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const createRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: CreateBody; Reply: ReplyEnvelope<Team> }>(
    '/new',
    {
      preHandler: auth({ scopes: ['teams:manage'] }),
      schema: {
        body: TeamCreateBodySchema,
        description:
          'An admin can assign any manager or admin as manager, a manager always becomes the manager of the team. The end of the working day must be after its start.',
        response: TeamResponses.create,
        security: [{ bearerAuth: [] }],
        summary: 'Create a team',
        tags: ['teams'],
      },
    },
    team.create,
  );
};
