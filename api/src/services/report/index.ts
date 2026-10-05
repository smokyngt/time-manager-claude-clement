import { team } from './team.js';
import { user } from './user.js';

import type { Actor } from '@/types/entities/actor.js';
import type { Granularity, TeamReport, UserReport } from '@/types/entities/report.js';

export interface ReportServiceType {
  team: (params: TeamParams) => Promise<TeamResponse>;
  user: (params: UserParams) => Promise<UserResponse>;
}

export interface TeamParams {
  actor: Actor;
  from: number;
  granularity: Granularity;
  team_id: string;
  to: number;
}

export interface TeamResponse {
  report: TeamReport;
}

export interface UserParams {
  actor: Actor;
  from: number;
  granularity: Granularity;
  to: number;
  user_id: string;
}

export interface UserResponse {
  report: UserReport;
}

class ReportService implements ReportServiceType {
  public team = team;
  public user = user;
}

export const reportService = new ReportService();
