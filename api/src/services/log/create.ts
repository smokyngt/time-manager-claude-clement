import { db } from '@/db/client.js';
import { auditLogs } from '@/db/schema/index.js';
import { LogCreateError } from '@/lib/errors/index.js';

import type { CreateLogParams, CreateLogResponse } from './index.js';

/**
 * @route log.service.create
 * @param {CreateLogParams} params
 * @returns {Promise<CreateLogResponse>}
 * @throws {LogCreateError}
 */
export const create = async (params: CreateLogParams): Promise<CreateLogResponse> => {
  try {
    const { actor, event, metadata } = params;
    await db.insert(auditLogs).values({
      actor_id: actor?.id ?? null,
      actor_role: actor?.role ?? null,
      event,
      metadata: metadata ?? {},
    });

    return { success: true };
  } catch (error) {
    throw LogCreateError({ cause: error, metadata: { route: 'log.service.create' } });
  }
};
