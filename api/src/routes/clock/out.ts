import { clock } from '@/controllers/clock/index.js';
import { auth } from '@/plugins/auth.js';
import { ClockNoteBodySchema, ClockResponses } from '@/schemas/clock.js';

import type { OutBody } from '@/controllers/clock/index.js';
import type { Clock } from '@/types/entities/clock.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const outRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: OutBody; Reply: ReplyEnvelope<Clock> }>(
    '/out',
    {
      preHandler: auth({ scopes: ['clocks:write'] }),
      schema: {
        body: ClockNoteBodySchema,
        description:
          'Closes the open clock of the caller at the current time. Fails with a conflict when the caller is not clocked in.',
        response: ClockResponses.out,
        security: [{ bearerAuth: [] }],
        summary: 'Clock out',
        tags: ['clocks'],
      },
    },
    clock.out,
  );
};
