import { clock } from '@/controllers/clock/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { ClockInBodySchema, ClockResponses } from '@/schemas/clock.js';

import type { ClockInBody, ClockResponse } from '@/controllers/clock/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const clockIn: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: ClockInBody; Reply: ReplyEnvelope<ClockResponse> }>(
    '/in',
    {
      preHandler: auth({ scopes: ['clocks:write'] }),
      schema: {
        body: ClockInBodySchema,
        description:
          'Opens a clock for the caller at the current time. Fails with a conflict when the caller is already clocked in.',
        response: ClockResponses.in,
        security: [{ bearerAuth: [] }],
        summary: 'Clock in',
        tags: ['clocks'],
      },
    },
    clock.clockIn,
  );
};

export { clockIn };
