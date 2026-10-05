import { user } from '@/controllers/user/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { UserIdParamsSchema, UserResponses } from '@/schemas/user.js';

import type { RetrieveParams, UserResponse } from '@/controllers/user/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const retrieve: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: RetrieveParams; Reply: ReplyEnvelope<UserResponse> }>(
    '/:id',
    {
      preHandler: auth({ scopes: ['users:read'] }),
      schema: {
        description:
          'Employees can only retrieve themselves. Managers can retrieve employees.',
        params: UserIdParamsSchema,
        response: UserResponses.retrieve,
        security: [{ bearerAuth: [] }],
        summary: 'Retrieve a user',
        tags: ['users'],
      },
    },
    user.retrieve,
  );
};

export { retrieve };
