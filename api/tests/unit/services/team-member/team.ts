import { MANAGER_ID } from '../../../helpers/fixtures.js';

import type { TeamRow } from '@/db/schema/team.js';

export const TEAM_ID = '00000000-0000-4000-8000-0000000000e1';

export const makeTeam = (overrides: Partial<TeamRow> = {}): TeamRow => ({
  archived_at: null,
  created_at: 1_700_000_000_000,
  description: null,
  id: TEAM_ID,
  manager_id: MANAGER_ID,
  name: 'Team',
  updated_at: null,
  weekly_hours_target: 35,
  work_end: '17:00',
  work_start: '09:00',
  ...overrides,
});
