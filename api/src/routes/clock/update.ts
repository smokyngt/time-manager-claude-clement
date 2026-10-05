import { clock } from '@/controllers/clock/index.js';
import { auth } from '@/plugins/auth.js';
import { ClockResponses, ClockUpdateBodySchema } from '@/schemas/clock.js';

import type { UpdateBody, UpdateResponse } from '@/controllers/clock/index.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const updateRoute: FastifyPluginAsync = async (fastify) => {
  fastify.patch<{ Body: UpdateBody; Reply: ReplyEnvelope<UpdateResponse> }>(
    '',
    {
      preHandler: auth({ scopes: ['clocks:manage'] }),
      schema: {
        body: ClockUpdateBodySchema,
        description:
          'Applies the same data to every id. Authorization is checked for every item before any write. A corrected clock must stay valid and must not overlap another clock of the same user.',
        response: ClockResponses.update,
        security: [{ bearerAuth: [] }],
        summary: 'Update clocks in bulk',
        tags: ['clocks'],
      },
    },
    clock.update,
  );
};
