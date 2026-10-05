import { report } from '@/controllers/report/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { ReportResponses, ReportTeamBodySchema } from '@/schemas/report.js';

import type { TeamBody } from '@/controllers/report/index.js';
import type { TeamReport } from '@/types/entities/report.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const team: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: TeamBody; Reply: ReplyEnvelope<{ report: TeamReport }> }>(
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
    report.team,
  );
};

export { team };
