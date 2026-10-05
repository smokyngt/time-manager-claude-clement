export const GRANULARITIES = ['day', 'month', 'week'] as const;

export type Granularity = (typeof GRANULARITIES)[number];

export interface TeamMemberReport {
  days_worked: number;
  first_name: string;
  last_name: string;
  late_days: number;
  overtime_ms: number;
  user_id: string;
  worked_ms: number;
}

export interface TeamReport {
  from: number;
  granularity: Granularity;
  kpis: TeamReportKpis;
  members: TeamMemberReport[];
  object: 'team_report';
  series: TeamReportPoint[];
  team_id: string;
  to: number;
}

export interface TeamReportKpis {
  active_members: number;
  average_daily_ms: number;
  late_days: number;
  lateness_rate: number;
  member_count: number;
  overtime_ms: number;
  worked_ms: number;
}

export interface TeamReportPoint {
  period_start: number;
  worked_ms: number;
}

export interface UserReport {
  from: number;
  granularity: Granularity;
  kpis: UserReportKpis;
  object: 'user_report';
  series: UserReportPoint[];
  to: number;
  user_id: string;
}

export interface UserReportKpis {
  average_daily_ms: number;
  days_worked: number;
  late_days: number;
  lateness_rate: number;
  overtime_ms: number;
  target_ms: number;
  worked_ms: number;
}

export interface UserReportPoint {
  late: number;
  period_start: number;
  worked_ms: number;
}
