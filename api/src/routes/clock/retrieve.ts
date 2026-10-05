import { clockController } from '@/controllers/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { ClockIdParamsSchema, ClockResponses } from '@/schemas/index.js';

import type { ClockResponse, RetrieveClockParams } from '@/controllers/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const retrieve: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: RetrieveClockParams; Reply: ReplyEnvelope<ClockResponse> }>(
    '/:id',
    {
      preHandler: auth({ scopes: ['clocks:read'] }),
      schema: {
        description:
          'Readable by the owner, the manager of the owner and admins. Clocks outside the caller scope are reported as not found.',
        params: ClockIdParamsSchema,
        response: ClockResponses.retrieve,
        security: [{ bearerAuth: [] }],
        summary: 'Retrieve a clock',
        tags: ['clocks'],
      },
    },
    clockController.retrieve,
  );
};

export { retrieve };
