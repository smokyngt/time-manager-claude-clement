import { AppError, InternalError, UnauthorizedError, UserNotFoundError , UserUpdateError, ValidationError  } from '@/lib/errors/index.js';
import { UserUpdated } from '@/lib/events/index.js';
import { RequestLimits } from '@/schemas/index.js';
import { userService } from '@/services/index.js';
import { Access } from '@/utils/auth/authz.js';
import { Reply } from '@/utils/http/reply.js';

import type { UpdateUsersBody, UpdateUsersResponse } from './index.js';
import type { BulkFailure, User } from '@/types/entities/index.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route user.controller.update
 * @param {FastifyRequest<{ Body: UpdateUsersBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<UpdateUsersResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {UnauthorizedError | UserUpdateError | ValidationError}
 */
export const update = async (
  req: FastifyRequest<{ Body: UpdateUsersBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<UpdateUsersResponse> }>,
): Promise<void> => {
  try {
    const { actor } = Access.context(req);
    const { data } = req.body;
    const ids = [...new Set(req.body.ids)];
    if (ids.length === 0 || ids.length > RequestLimits.bulk) {
      throw ValidationError({ metadata: { field: 'ids', route: 'user.controller.update' } });
    }
    const keys = Object.keys(data);
    const failed: BulkFailure[] = [];
    const targets: User[] = [];
    const loaded = await Promise.all(
      ids.map(async (id) => {
        if (!Access.user.reach(actor, id)) {
          throw UnauthorizedError({ metadata: { route: 'user.controller.update', user_id: id } });
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
      Access.user.require(actor, 'update', item.user);
      const allowed = Access.user.fields(actor, item.user);
      if (!keys.every((key) => allowed.includes(key))) {
        throw UnauthorizedError({
          metadata: { route: 'user.controller.update', user_id: item.id },
        });
      }
      targets.push(item.user);
    }
    const updated: string[] = [];
    await Promise.all(
      targets.map(async (target) => {
        try {
          await userService.update({ actor, data, id: target.id });
          updated.push(target.id);
        } catch (error) {
          failed.push({
            code: AppError.is(error) ? error.code : InternalError.code,
            id: target.id,
          });
        }
      }),
    );
    const result: UpdateUsersResponse = { failed, success: failed.length === 0, updated };
    await Reply.send(
      req,
      reply,
      UserUpdated({
        payload: { actor: actor.id, failed: failed.length, updated: updated.length },
      }),
      result,
    );
  } catch (error) {
    throw UserUpdateError({ cause: error, metadata: { route: 'user.controller.update' } });
  }
};
