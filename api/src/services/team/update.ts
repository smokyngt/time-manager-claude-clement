import { eq } from 'drizzle-orm';

import { db } from '@/db/client.js';
import { teams } from '@/db/schema/team.js';
import { TeamNotFoundError, TeamUpdateError } from '@/lib/errors/domains/team.js';
import { logService } from '@/services/log/index.js';
import { TeamMapper } from '@/utils/team-mapper.js';

import { TeamQuery } from './query.js';
import { TeamValidate } from './validate.js';

import type { UpdateParams, UpdateResponse } from './index.js';
import type { TeamInsert } from '@/db/schema/team.js';

/**
 * @route team.service.update
 * @param {UpdateParams} params
 * @returns {Promise<UpdateResponse>}
 * @throws {TeamUpdateError}
 */
export const update = async (params: UpdateParams): Promise<UpdateResponse> => {
  try {
    const { actor, data, id } = params;
    const route = 'team.service.update';
    if (data.manager_id !== undefined) await TeamValidate.manager(data.manager_id, route);
    if (data.work_start !== undefined || data.work_end !== undefined) {
      let start = data.work_start;
      let end = data.work_end;
      if (start === undefined || end === undefined) {
        const [current] = await db
          .select({ work_end: teams.work_end, work_start: teams.work_start })
          .from(teams)
          .where(eq(teams.id, id))
          .limit(1);
        if (current === undefined) throw TeamNotFoundError({ metadata: { route, team_id: id } });
        start ??= current.work_start;
        end ??= current.work_end;
      }
      TeamValidate.schedule(start, end, route);
    }
    const values: Partial<TeamInsert> = { updated_at: Date.now() };
    if (data.description !== undefined) values.description = data.description;
    if (data.manager_id !== undefined) values.manager_id = data.manager_id;
    if (data.name !== undefined) values.name = data.name;
    if (data.weekly_hours_target !== undefined)
      values.weekly_hours_target = data.weekly_hours_target;
    if (data.work_end !== undefined) values.work_end = data.work_end;
    if (data.work_start !== undefined) values.work_start = data.work_start;
    const [row] = await db.update(teams).set(values).where(eq(teams.id, id)).returning();
    if (row === undefined) throw TeamNotFoundError({ metadata: { route, team_id: id } });
    await logService.create({
      actor,
      event: 'team.updated',
      metadata: { fields: Object.keys(data), team_id: id },
    });
    return { team: TeamMapper.entity(row, await TeamQuery.count(id)) };
  } catch (error) {
    throw TeamUpdateError({ cause: error, metadata: { route: 'team.service.update' } });
  }
};
