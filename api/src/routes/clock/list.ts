import { clock } from '@/controllers/clock/index.js';
import { auth } from '@/plugins/auth.js';
import { ClockListBodySchema, ClockResponses } from '@/schemas/clock.js';

import type { ListBody, ListResponse } from '@/controllers/clock/index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const listRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: ListBody; Reply: ReplyEnvelope<ListResponse> }>(
    '/list',
    {
      preHandler: auth({ scopes: ['clocks:read'] }),
      schema: {
        body: ClockListBodySchema,
        description:
          'Cursor paginated list ordered by creation time. Employees only see their own clocks, managers see their own and those of the users they manage.',
        response: ClockResponses.list,
        security: [{ bearerAuth: [] }],
        summary: 'List clocks',
        tags: ['clocks'],
      },
    },
    clock.list,
  );
};
