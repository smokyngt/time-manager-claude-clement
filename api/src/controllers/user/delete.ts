import { UserDeleteError } from '@/lib/errors/domains/user.js';
import { AppError, ForbiddenError, InternalError, ValidationError } from '@/lib/errors/index.js';
import { UserDeleted } from '@/lib/events/domains/user.js';
import { RequestLimits } from '@/schemas/common.js';
import { userService } from '@/services/user/index.js';
import { Access } from '@/utils/access.js';
import { Reply } from '@/utils/reply.js';

import type { BulkFailure, DeleteBody, DeleteResponse } from './index.js';
import type { User } from '@/types/entities/user.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route user.controller.delete
 * @param {FastifyRequest<{ Body: DeleteBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<DeleteResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {UserDeleteError}
 */
export const remove = async (
  req: FastifyRequest<{ Body: DeleteBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<DeleteResponse> }>,
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
          throw ForbiddenError({ metadata: { route: 'user.controller.delete' } });
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
      Access.user.require(actor, 'delete', item.user);
      if (!(await Access.user.scope(actor, item.user.id))) {
        throw ForbiddenError({ metadata: { route: 'user.controller.delete' } });
      }
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
    const result: DeleteResponse = { deleted, failed, success: failed.length === 0 };
    await Reply.send(
      req,
      reply,
      UserDeleted({ payload: { deleted: deleted.length, failed: failed.length } }),
      result,
    );
  } catch (error) {
    throw UserDeleteError({ cause: error, metadata: { route: 'user.controller.delete' } });
  }
};
