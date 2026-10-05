import type { HttpClient } from '../http.js';
import type {
  TeamReportParams,
  TeamReportResponse,
  UserReportParams,
  UserReportResponse,
} from '../types.js';

/** Report endpoints (`/v1/reports`). */
export class ReportsResource {
  public constructor(private readonly http: HttpClient) {}

  /** Computes the KPIs of a team over a range. */
  public team(params: TeamReportParams): Promise<TeamReportResponse> {
    return this.http.post<TeamReportResponse>('/v1/reports/team', params);
  }

  /** Computes the KPIs of a user over a range. */
  public user(params: UserReportParams): Promise<UserReportResponse> {
    return this.http.post<UserReportResponse>('/v1/reports/user', params);
  }
}
