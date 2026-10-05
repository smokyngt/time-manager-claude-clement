import { db } from '@/db/client.js';
import { teams } from '@/db/schema/team.js';
import { TeamCreateError } from '@/lib/errors/domains/team.js';
import { logService } from '@/services/log/index.js';
import { TeamMapper } from '@/utils/team-mapper.js';

import { TeamValidate } from './validate.js';

import type { CreateParams, CreateResponse } from './index.js';

/**
 * @route team.service.create
 * @param {CreateParams} params
 * @returns {Promise<CreateResponse>}
 * @throws {TeamCreateError}
 */
export const create = async (params: CreateParams): Promise<CreateResponse> => {
  try {
    const { actor, data } = params;
    await TeamValidate.manager(data.manager_id, 'team.service.create');
    TeamValidate.schedule(
      data.work_start ?? '09:00',
      data.work_end ?? '17:00',
      'team.service.create',
    );
    const [row] = await db
      .insert(teams)
      .values({
        description: data.description ?? null,
        manager_id: data.manager_id,
        name: data.name,
        weekly_hours_target: data.weekly_hours_target ?? 35,
        work_end: data.work_end ?? '17:00',
        work_start: data.work_start ?? '09:00',
      })
      .returning();
    if (row === undefined) throw TeamCreateError({ metadata: { route: 'team.service.create' } });
    await logService.create({
      actor,
      event: 'team.created',
      metadata: { manager_id: row.manager_id, team_id: row.id },
    });
    return { team: TeamMapper.entity(row, 0) };
  } catch (error) {
    throw TeamCreateError({ cause: error, metadata: { route: 'team.service.create' } });
  }
};
