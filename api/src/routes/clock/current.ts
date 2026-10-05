import { clock } from '@/controllers/clock/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { ClockResponses } from '@/schemas/clock.js';

import type { CurrentResponse } from '@/controllers/clock/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const current: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Reply: ReplyEnvelope<CurrentResponse> }>(
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
    clock.current,
  );
};

export { current };
