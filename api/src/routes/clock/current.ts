import { clockController } from '@/controllers/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { ClockResponses } from '@/schemas/index.js';

import type { CurrentClockResponse } from '@/controllers/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const current: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Reply: ReplyEnvelope<CurrentClockResponse> }>(
    '/current',
    {
      preHandler: auth({ scopes: ['clocks:read'] }),
      schema: {
        description:
          'Returns the open clock of the caller, or null when the caller is not clocked in.',
        response: ClockResponses.current,
        security: [{ bearerAuth: [] }],
        summary: 'Retrieve the current clock',
        tags: ['clocks'],
      },
    },
    clockController.current,
  );
};

export { current };
