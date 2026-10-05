import { UserNotFoundError, UserUpdateError } from '@/lib/errors/domains/user.js';
import { AppError, ForbiddenError, InternalError, ValidationError } from '@/lib/errors/index.js';
import { UserUpdated } from '@/lib/events/domains/user.js';
import { RequestLimits } from '@/schemas/common.js';
import { userService } from '@/services/user/index.js';
import { Access } from '@/utils/access.js';
import { Reply } from '@/utils/reply.js';

import type { BulkFailure, UpdateBody, UpdateResponse } from './index.js';
import type { User } from '@/types/entities/user.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * @route user.controller.update
 * @param {FastifyRequest<{ Body: UpdateBody }>} req
 * @param {FastifyReply<{ Reply: ReplyEnvelope<UpdateResponse> }>} reply
 * @returns {Promise<void>}
 * @throws {UserUpdateError}
 */
export const update = async (
  req: FastifyRequest<{ Body: UpdateBody }>,
  reply: FastifyReply<{ Reply: ReplyEnvelope<UpdateResponse> }>,
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
          throw ForbiddenError({ metadata: { route: 'user.controller.update' } });
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
        throw ForbiddenError({ metadata: { route: 'user.controller.update' } });
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
    const result: UpdateResponse = { failed, success: failed.length === 0, updated };
    await Reply.send(
      req,
      reply,
      UserUpdated({ payload: { failed: failed.length, updated: updated.length } }),
      result,
    );
  } catch (error) {
    throw UserUpdateError({ cause: error, metadata: { route: 'user.controller.update' } });
  }
};
