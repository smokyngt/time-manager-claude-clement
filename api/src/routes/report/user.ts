import { report } from '@/controllers/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { ReportResponses, ReportUserBodySchema } from '@/schemas/index.js';

import type { ReportUserBody } from '@/controllers/index.js';
import type { UserReport } from '@/types/entities/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const user: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: ReportUserBody; Reply: ReplyEnvelope<{ report: UserReport }> }>(
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

export { user };
