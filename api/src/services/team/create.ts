import { db } from '@/db/client.js';
import { teams } from '@/db/schema/team.js';
import { TeamCreateError } from '@/lib/errors/domains/team.js';
import { TeamCreated } from '@/lib/events/domains/team.js';
import { logService } from '@/services/log/index.js';
import { Cipher } from '@/utils/crypto/cipher.js';
import { TeamMapper } from '@/utils/mappers/team.js';

import { TeamValidate } from './validate.js';

import type { CreateParams, CreateResponse } from './index.js';

/**
 * @route team.service.create
 * @param {CreateParams} params
 * @returns {Promise<CreateResponse>}
 * @throws {TeamCreateError | TeamManagerInvalidError | TeamScheduleInvalidError}
 */
export const create = async (params: CreateParams): Promise<CreateResponse> => {
  try {
    const { actor, data } = params;
    const start = data.work_start ?? '09:00';
    const end = data.work_end ?? '17:00';
    await TeamValidate.manager(data.manager_id);
    TeamValidate.schedule(start, end);
    const [row] = await db
      .insert(teams)
      .values({
        description: Cipher.nullable.seal(data.description ?? null),
        manager_id: data.manager_id,
        name: Cipher.seal(data.name),
        weekly_hours_target: data.weekly_hours_target,
        work_end: end,
        work_start: start,
      })
      .returning();
    if (row === undefined) throw TeamCreateError({ metadata: { route: 'team.service.create' } });
    await logService.create({
      actor,
      event: TeamCreated.code,
      metadata: { manager_id: row.manager_id, team_id: row.id },
    });

    return { team: TeamMapper.entity(row, 0) };
  } catch (error) {
    throw TeamCreateError({ cause: error, metadata: { route: 'team.service.create' } });
  }
};
