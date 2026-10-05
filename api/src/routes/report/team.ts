import { reportController } from '@/controllers/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { ReportResponses, ReportTeamBodySchema } from '@/schemas/index.js';

import type { ReportTeamBody } from '@/controllers/index.js';
import type { TeamReport } from '@/types/entities/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const team: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: ReportTeamBody; Reply: ReplyEnvelope<{ report: TeamReport }> }>(
    '/team',
    {
      preHandler: auth({ scopes: ['reports:read'] }),
      schema: {
        body: ReportTeamBodySchema,
        description:
          'Open clocks count until now. Managers can report on the teams they manage, admins on every team.',
        response: ReportResponses.team,
        security: [{ bearerAuth: [] }],
        summary: 'Report the indicators of a team',
        tags: ['reports'],
      },
    },
    reportController.team,
  );
};

export { team };
