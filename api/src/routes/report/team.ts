import { report } from '@/controllers/report/index.js';
import { auth } from '@/plugins/auth.js';
import { ReportResponses, ReportTeamBodySchema } from '@/schemas/report.js';

import type { TeamBody } from '@/controllers/report/index.js';
import type { TeamReport } from '@/types/entities/report.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const teamRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: TeamBody; Reply: ReplyEnvelope<TeamReport> }>(
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
