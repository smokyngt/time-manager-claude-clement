import type { components } from '@/lib/api/schema'

export type Granularity = 'day' | 'month' | 'week'

export interface ReportsPaths {
  '/v1/reports/team': {
    post: {
      requestBody: JsonBody<TeamReportParams>
      responses: ReportResponses<TeamReport>
    }
  }
  '/v1/reports/user': {
    post: {
      requestBody: JsonBody<UserReportParams>
      responses: ReportResponses<UserReport>
    }
  }
}

export interface TeamKpis {
  active_members: number
  average_daily_ms: number
  late_days: number
  lateness_rate: number
  member_count: number
  overtime_ms: number
  worked_ms: number
}

export interface TeamMemberReport {
  days_worked: number
  first_name: string
  last_name: string
  late_days: number
  overtime_ms: number
  user_id: string
  worked_ms: number
}

export interface TeamReport {
  from: number
  granularity: Granularity
  kpis: TeamKpis
  members: TeamMemberReport[]
  object: 'team_report'
  series: TeamSeriesPoint[]
  team_id: string
  to: number
}

export interface TeamReportParams {
  from: number
  granularity: Granularity
  team_id: string
  to: number
}

export interface TeamSeriesPoint {
  period_start: number
  worked_ms: number
}

export interface UserKpis {
  average_daily_ms: number
  days_worked: number
  late_days: number
  lateness_rate: number
  overtime_ms: number
  target_ms: number
  worked_ms: number
}

export interface UserReport {
  from: number
  granularity: Granularity
  kpis: UserKpis
  object: 'user_report'
  series: UserSeriesPoint[]
  to: number
  user_id: string
}

export interface UserReportParams {
  from: number
  granularity: Granularity
  user_id: string
}

export interface UserSeriesPoint {
  late: number
  period_start: number
  worked_ms: number
}

interface JsonBody<T> {
  content: { 'application/json': T }
}

interface ReportResponses<T> {
  200: { content: { 'application/json': { data: T; event: null | string } }; headers: Record<string, unknown> }
  403: { content: { 'application/json': components['schemas']['ApiError'] }; headers: Record<string, unknown> }
  422: { content: { 'application/json': components['schemas']['ApiError'] }; headers: Record<string, unknown> }
}
