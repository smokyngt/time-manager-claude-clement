import { clock } from '@/controllers/clock/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { ClockListBodySchema, ClockResponses } from '@/schemas/clock.js';

import type { ListBody, ListResponse } from '@/controllers/clock/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const list: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: ListBody; Reply: ReplyEnvelope<ListResponse> }>(
    '/list',
    {
      preHandler: auth({ scopes: ['clocks:read'] }),
      schema: {
        body: ClockListBodySchema,
        description:
          'Cursor paginated list ordered by creation time. Employees only see their own clocks, managers see their own and those of the users they manage, admins see all.',
        response: ClockResponses.list,
        security: [{ bearerAuth: [] }],
        summary: 'List clocks',
        tags: ['clocks'],
      },
    },
    clock.list,
  );
};

export { list };
