import { AppError, InternalError, UnauthorizedError, UserDeleteError , UserNotFoundError, ValidationError  } from '@/lib/errors/index.js';
import { UserDeleted } from '@/lib/events/index.js';
import { RequestLimits } from '@/schemas/index.js';
import { userService } from '@/services/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { DeleteUsersBody, DeleteUsersResponse } from './index.js';
import type { BulkFailure, User } from '@/types/entities/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route user.controller.delete
 * @param {FastifyRequest<{ Body: DeleteUsersBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<DeleteUsersResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {UnauthorizedError | UserDeleteError | ValidationError}
 */
export const remove = async (
  req: FastifyRequest<{ Body: DeleteUsersBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<DeleteUsersResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const ids = [...new Set(req.body.ids)];
    if (ids.length === 0 || ids.length > RequestLimits.bulk) {
      throw ValidationError({ metadata: { field: 'ids', route: 'user.controller.delete' } });
    }
    const failed: BulkFailure[] = [];
    const targets: User[] = [];
    const loaded = await Promise.all(
      ids.map(async (id) => {
        if (!Access.user.reach(actor, id)) {
          throw UnauthorizedError({ metadata: { route: 'user.controller.delete', user_id: id } });
        }

        return userService.retrieve({ id }).then(
          ({ user }) => ({ id, user }),
          (error: unknown) => ({ error, id }),
        );
      }),
    );
    for (const item of loaded) {
      if ('error' in item) {
        failed.push({
          code: AppError.is(item.error) ? item.error.code : InternalError.code,
          id: item.id,
        });
        continue;
      }
      if (!(await Access.user.scope(actor, item.user))) {
        failed.push({ code: UserNotFoundError.code, id: item.id });
        continue;
      }
      Access.user.require(actor, 'delete', item.user);
      targets.push(item.user);
    }
    const deleted: string[] = [];
    await Promise.all(
      targets.map(async (target) => {
        try {
          await userService.delete({ actor, id: target.id });
          deleted.push(target.id);
        } catch (error) {
          failed.push({
            code: AppError.is(error) ? error.code : InternalError.code,
            id: target.id,
          });
        }
      }),
    );
    const result: DeleteUsersResponse = { deleted, failed, success: failed.length === 0 };
    await Reply.send(
      req,
      reply,
      UserDeleted({
        payload: { actor: actor.id, deleted: deleted.length, failed: failed.length },
      }),
      result,
    );
  } catch (error) {
    throw UserDeleteError({ cause: error, metadata: { route: 'user.controller.delete' } });
  }
};
