import { clock } from '@/controllers/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { ClockResponses, ClockUpdateBodySchema } from '@/schemas/index.js';

import type { UpdateClocksBody, UpdateClocksResponse } from '@/controllers/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const update: FastifyPluginAsync = async (fastify) => {
  fastify.patch<{ Body: UpdateClocksBody; Reply: ReplyEnvelope<UpdateClocksResponse> }>(
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

export { update };
