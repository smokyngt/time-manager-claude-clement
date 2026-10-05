import { team } from './team.js';
import { user } from './user.js';

import type { Granularity, TeamReport, UserReport } from '@/types/entities/report.js';

export type ReportServiceType = {
  team: (params: TeamParams) => Promise<TeamResponse>;
  user: (params: UserParams) => Promise<UserResponse>;
};

export type TeamParams = {
  from: number;
  granularity: Granularity;
  manager_id?: string;
  team_id: string;
  to: number;
};

export type TeamResponse = {
  report: TeamReport;
};

export type UserParams = {
  from: number;
  granularity: Granularity;
  to: number;
  user_id: string;
};

export type UserResponse = {
  report: UserReport;
};

class ReportService implements ReportServiceType {
  public team = team;
  public user = user;
}

export const reportService = new ReportService();
