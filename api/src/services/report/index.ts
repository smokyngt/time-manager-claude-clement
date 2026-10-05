import { team } from './team.js';
import { user } from './user.js';

import type { Granularity, TeamReport, UserReport } from '@/types/entities/index.js';

export type ReportTeamParams = {
  from: number;
  granularity: Granularity;
  manager_id?: string;
  team_id: string;
  to: number;
};

export type ReportTeamResponse = {
  report: TeamReport;
};

export type ReportUserParams = {
  from: number;
  granularity: Granularity;
  to: number;
  user_id: string;
};

export type ReportUserResponse = {
  report: UserReport;
};

export class ReportService {
  public team = team;
  public user = user;
}

export const reportService = new ReportService();
