import { userController } from '@/controllers/index.js';
import { auth } from '@/middlewares/auth/index.js';
import { UserResponses, UserUpdateBodySchema } from '@/schemas/index.js';

import type { UpdateUsersBody, UpdateUsersResponse } from '@/controllers/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyPluginAsync } from 'fastify';

const update: FastifyPluginAsync = async (fastify) => {
  fastify.patch<{ Body: UpdateUsersBody; Reply: ReplyEnvelope<UpdateUsersResponse> }>(
    '',
    {
      preHandler: auth({ scopes: ['users:write'] }),
      schema: {
        body: UserUpdateBodySchema,
        description:
          'Applies the same data to every id. Authorization is checked for every item before any write. Employees can only change their own names, phone number and password.',
        response: UserResponses.update,
        security: [{ bearerAuth: [] }],
        summary: 'Update users in bulk',
        tags: ['users'],
      },
    },
    userController.update,
  );
};

export { update };
