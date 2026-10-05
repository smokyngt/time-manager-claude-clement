import { clockController } from '@/controllers/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { ClockDeleteBodySchema, ClockResponses } from '@/schemas/index.js';

import type { DeleteClocksBody, DeleteClocksResponse } from '@/controllers/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const deleteRoute: FastifyPluginAsync = async (fastify) => {
  fastify.delete<{ Body: DeleteClocksBody; Reply: ReplyEnvelope<DeleteClocksResponse> }>(
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
    clockController.delete,
  );
};

export { deleteRoute };
