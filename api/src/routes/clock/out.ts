import { clockController } from '@/controllers/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { ClockOutBodySchema, ClockResponses } from '@/schemas/index.js';

import type { ClockOutBody, ClockResponse } from '@/controllers/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const clockOut: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: ClockOutBody; Reply: ReplyEnvelope<ClockResponse> }>(
    '/out',
    {
      preHandler: auth({ scopes: ['clocks:write'] }),
      schema: {
        body: ClockOutBodySchema,
        description:
          'Closes the open clock of the caller at the current time. Fails with a conflict when the caller is not clocked in, and with an invalid clock error when the open clock is older than 24 hours.',
        response: ClockResponses.out,
        security: [{ bearerAuth: [] }],
        summary: 'Clock out',
        tags: ['clocks'],
      },
    },
    clockController.clockOut,
  );
};

export { clockOut };
