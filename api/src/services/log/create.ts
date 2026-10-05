import { db } from '@/db/client.js';
import { auditLogs } from '@/db/schema/audit-log.js';
import { LogCreateError } from '@/lib/errors/domains/log.js';

import type { CreateParams, CreateResponse } from './index.js';

/**
 * @route log.service.create
 * @param {CreateParams} params
 * @returns {Promise<CreateResponse>}
 * @throws {LogCreateError}
 */
export const create = async (params: CreateParams): Promise<CreateResponse> => {
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
