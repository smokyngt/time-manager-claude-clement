import type { HttpClient } from '../http.js';
import type { TeamReport, TeamReportParams, UserReport, UserReportParams } from '../types.js';

/** Report endpoints (`/v1/reports`). */
export class ReportsResource {
  public constructor(private readonly http: HttpClient) {}

  /** Computes the KPIs of a team over a range. */
  public async team(params: TeamReportParams): Promise<TeamReport> {
    return (await this.http.post<{ report: TeamReport }>('/v1/reports/team', params)).report;
  }

  /** Computes the KPIs of a user over a range. */
  public async user(params: UserReportParams): Promise<UserReport> {
    return (await this.http.post<{ report: UserReport }>('/v1/reports/user', params)).report;
  }
}
