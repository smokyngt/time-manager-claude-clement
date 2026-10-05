import { team } from './team.js';
import { user } from './user.js';

import type { Granularity } from '@/types/entities/index.js';

export type ReportTeamBody = {
  from: number;
  granularity: Granularity;
  team_id: string;
  to: number;
};

export type ReportUserBody = {
  from: number;
  granularity: Granularity;
  to: number;
  user_id: string;
};

export class ReportController {
  public team = team;
  public user = user;
}

export const reportController = new ReportController();
