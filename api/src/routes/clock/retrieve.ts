import { clock } from '@/controllers/clock/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { ClockIdParamsSchema, ClockResponses } from '@/schemas/clock.js';

import type { ClockResponse, RetrieveParams } from '@/controllers/clock/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const retrieve: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: RetrieveParams; Reply: ReplyEnvelope<ClockResponse> }>(
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
    clock.retrieve,
  );
};

export { retrieve };
