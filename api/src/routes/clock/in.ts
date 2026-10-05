import { clock } from '@/controllers/clock/index.js';
import { auth } from '@/plugins/auth.js';
import { ClockNoteBodySchema, ClockResponses } from '@/schemas/clock.js';

import type { InBody } from '@/controllers/clock/index.js';
import type { Clock } from '@/types/entities/clock.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const inRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: InBody; Reply: ReplyEnvelope<Clock> }>(
    '/in',
    {
      preHandler: auth({ scopes: ['clocks:write'] }),
      schema: {
        body: ClockNoteBodySchema,
        description:
          'Opens a clock for the caller at the current time. Fails with a conflict when the caller is already clocked in.',
        response: ClockResponses.in,
        security: [{ bearerAuth: [] }],
        summary: 'Clock in',
        tags: ['clocks'],
      },
    },
    clock.in,
  );
};
