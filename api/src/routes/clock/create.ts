import { clock } from '@/controllers/clock/index.js';
import { auth } from '@/plugins/auth.js';
import { ClockCreateBodySchema, ClockResponses } from '@/schemas/clock.js';

import type { CreateBody } from '@/controllers/clock/index.js';
import type { Clock } from '@/types/entities/clock.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const createRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: CreateBody; Reply: ReplyEnvelope<Clock> }>(
    '/new',
    {
      preHandler: auth({ scopes: ['clocks:manage'] }),
      schema: {
        body: ClockCreateBodySchema,
        description:
          'Manual entry of a closed clock. Managers can only create clocks for the users they manage. The clock must not overlap another clock of the same user.',
        response: ClockResponses.create,
        security: [{ bearerAuth: [] }],
        summary: 'Create a clock',
        tags: ['clocks'],
      },
    },
    clock.create,
  );
};
