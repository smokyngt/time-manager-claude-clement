import { report } from '@/controllers/report/index.js';
import { auth } from '@/plugins/auth.js';
import { ReportResponses, ReportUserBodySchema } from '@/schemas/report.js';

import type { UserBody } from '@/controllers/report/index.js';
import type { UserReport } from '@/types/entities/report.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const userRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: UserBody; Reply: ReplyEnvelope<UserReport> }>(
    '/user',
    {
      preHandler: auth({ scopes: ['reports:read'] }),
      schema: {
        body: ReportUserBodySchema,
        description:
          'Open clocks count until now. Employees can only report on themselves, managers on their team members.',
        response: ReportResponses.user,
        security: [{ bearerAuth: [] }],
        summary: 'Report the indicators of a user',
        tags: ['reports'],
      },
    },
    report.user,
  );
};
