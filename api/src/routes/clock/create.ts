import { clock } from '@/controllers/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { ClockCreateBodySchema, ClockResponses } from '@/schemas/index.js';

import type { ClockResponse, CreateClockBody } from '@/controllers/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const create: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: CreateClockBody; Reply: ReplyEnvelope<ClockResponse> }>(
    '/new',
    {
      preHandler: auth({ scopes: ['clocks:manage'] }),
      schema: {
        body: ClockCreateBodySchema,
        description:
          'Manual entry of a closed clock, recorded with the manual source. Managers can only create clocks for the users they manage. The clock must not overlap another clock of the same user.',
        response: ClockResponses.create,
        security: [{ bearerAuth: [] }],
        summary: 'Create a clock',
        tags: ['clocks'],
      },
    },
    clock.create,
  );
};

export { create };
