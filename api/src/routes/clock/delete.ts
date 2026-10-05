import { clock } from '@/controllers/clock/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { ClockDeleteBodySchema, ClockResponses } from '@/schemas/clock.js';

import type { DeleteBody, DeleteResponse } from '@/controllers/clock/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const deleteRoute: FastifyPluginAsync = async (fastify) => {
  fastify.delete<{ Body: DeleteBody; Reply: ReplyEnvelope<DeleteResponse> }>(
    '',
    {
      preHandler: auth({ scopes: ['clocks:manage'] }),
      schema: {
        body: ClockDeleteBodySchema,
        description:
          'Permanently deletes clocks. Authorization is checked for every item before any deletion.',
        response: ClockResponses.delete,
        security: [{ bearerAuth: [] }],
        summary: 'Delete clocks in bulk',
        tags: ['clocks'],
      },
    },
    clock.delete,
  );
};

export { deleteRoute };
