import { clock } from '@/controllers/clock/index.js';
import { auth } from '@/plugins/auth.js';
import { ClockIdParamsSchema, ClockResponses } from '@/schemas/clock.js';

import type { RetrieveParams } from '@/controllers/clock/index.js';
import type { Clock } from '@/types/entities/clock.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const retrieveRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: RetrieveParams; Reply: ReplyEnvelope<Clock> }>(
    '/:id',
    {
      preHandler: auth({ scopes: ['clocks:read'] }),
      schema: {
        description: 'Readable by the owner, the manager of the owner and admins.',
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
