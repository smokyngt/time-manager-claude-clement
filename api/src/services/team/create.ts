import { db } from '@/db/client.js';
import { teams } from '@/db/schema/index.js';
import { TeamCreateError } from '@/lib/errors/index.js';
import { TeamCreated } from '@/lib/events/index.js';
import { Audit } from '@/services/log/audit.js';
import { Cipher } from '@/utils/crypto/cipher.js';
import { TeamMapper } from '@/utils/mappers/team.js';

import { TeamValidate } from './validate.js';

import type { CreateTeamParams, CreateTeamResponse } from './index.js';

/**
 * @route team.service.create
 * @param {CreateTeamParams} params
 * @returns {Promise<CreateTeamResponse>}
 * @throws {TeamCreateError | TeamManagerInvalidError | TeamScheduleInvalidError}
 */
export const create = async (params: CreateTeamParams): Promise<CreateTeamResponse> => {
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
    await Audit.record({
      actor,
      event: TeamCreated.code,
      metadata: { manager_id: row.manager_id, team_id: row.id },
    });

    return { team: TeamMapper.entity(row, 0) };
  } catch (error) {
    throw TeamCreateError({ cause: error, metadata: { route: 'team.service.create' } });
  }
};
