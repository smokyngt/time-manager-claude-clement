import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teams } from '@/db/schema/index.js';
import { TeamNotFoundError, TeamUpdateError } from '@/lib/errors/index.js';
import { TeamUpdated } from '@/lib/events/index.js';
import { Audit } from '@/services/log/audit.js';
import { Cipher } from '@/utils/crypto/cipher.js';
import { TeamMapper } from '@/utils/mappers/team.js';

import { TeamQuery } from './query.js';
import { TeamValidate } from './validate.js';

import type { UpdateTeamParams, UpdateTeamResponse } from './index.js';
import type { TeamInsert } from '@/db/schema/index.js';

/**
 * @route team.service.update
 * @param {UpdateTeamParams} params
 * @returns {Promise<UpdateTeamResponse>}
 * @throws {TeamManagerInvalidError | TeamNotFoundError | TeamScheduleInvalidError | TeamUpdateError}
 */
export const update = async (params: UpdateTeamParams): Promise<UpdateTeamResponse> => {
  try {
    const { actor, data, id } = params;
    if (data.manager_id !== undefined) await TeamValidate.manager(data.manager_id);
    if (data.work_start !== undefined || data.work_end !== undefined) {
      const [current] = await db
        .select({ work_end: teams.work_end, work_start: teams.work_start })
        .from(teams)
        .where(eq(teams.id, id))
        .limit(1);
      if (current === undefined) {
        throw TeamNotFoundError({ metadata: { route: 'team.service.update', team_id: id } });
      }
      TeamValidate.schedule(data.work_start ?? current.work_start, data.work_end ?? current.work_end);
    }
    const values: Partial<TeamInsert> = { updated_at: Date.now() };
    if (data.description !== undefined) values.description = Cipher.nullable.seal(data.description);
    if (data.manager_id !== undefined) values.manager_id = data.manager_id;
    if (data.name !== undefined) values.name = Cipher.seal(data.name);
    if (data.weekly_hours_target !== undefined) values.weekly_hours_target = data.weekly_hours_target;
    if (data.work_end !== undefined) values.work_end = data.work_end;
    if (data.work_start !== undefined) values.work_start = data.work_start;
    const [row] = await db.update(teams).set(values).where(eq(teams.id, id)).returning();
    if (row === undefined) {
      throw TeamNotFoundError({ metadata: { route: 'team.service.update', team_id: id } });
    }
    await Audit.record({
      actor,
      event: TeamUpdated.code,
      metadata: { fields: Object.keys(data), team_id: id },
    });

    return { team: TeamMapper.entity(row, await TeamQuery.count(id)) };
  } catch (error) {
    throw TeamUpdateError({ cause: error, metadata: { route: 'team.service.update' } });
  }
};
