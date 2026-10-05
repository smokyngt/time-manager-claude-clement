import { team } from '@/controllers/team/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { TeamCreateBodySchema, TeamResponses } from '@/schemas/team.js';

import type { CreateBody, TeamResponse } from '@/controllers/team/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const create: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: CreateBody; Reply: ReplyEnvelope<TeamResponse> }>(
    '/new',
    {
      preHandler: auth({ scopes: ['teams:manage'] }),
      schema: {
        body: TeamCreateBodySchema,
        description:
          'An admin can assign any active manager or admin as manager, a manager always becomes the manager of the team. The end of the working day must be after its start.',
        response: TeamResponses.create,
        security: [{ bearerAuth: [] }],
        summary: 'Create a team',
        tags: ['teams'],
      },
    },
    team.create,
  );
};

export { create };
