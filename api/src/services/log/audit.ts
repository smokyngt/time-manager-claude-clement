import { requestContext } from '@fastify/request-context';

import { AppError } from '@/lib/errors/index.js';

import { logService } from './index.js';

import type { CreateLogParams } from './index.js';

export class Audit {
  /**
   * @route log.audit.record
   * @param {CreateLogParams} params
   * @returns {Promise<void>}
   */
  public static async record(params: CreateLogParams): Promise<void> {
    try {
      await logService.create(params);
    } catch (error) {
      const fields = {
        actor_id: params.actor?.id,
        cause: AppError.is(error) ? error.code : 'unknown',
        event: params.event,
      };
      const log = requestContext.get('log');
      if (log === undefined) {
        process.stderr.write(`${JSON.stringify({ ...fields, level: 'warn', msg: 'audit log failed' })}\n`);

        return;
      }
      log.warn(fields, 'audit log failed');
    }
  }
}
