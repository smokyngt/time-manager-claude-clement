import { user } from '@/controllers/user/index.js';
import { auth } from '@/plugins/auth.js';
import { UserIdParamsSchema, UserResponses } from '@/schemas/user.js';

import type { RetrieveParams } from '@/controllers/user/index.js';
import type { User } from '@/types/entities/user.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyPluginAsync } from 'fastify';

export const retrieveRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: RetrieveParams; Reply: ReplyEnvelope<User> }>(
    '/:id',
    {
      preHandler: auth({ scopes: ['users:read'] }),
      schema: {
        description: 'Employees can only retrieve themselves. Managers can retrieve employees.',
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
