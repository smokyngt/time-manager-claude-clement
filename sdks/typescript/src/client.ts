import { HttpClient } from './http.js';
import {
  AuthResource,
  ClocksResource,
  ReportsResource,
  TeamMembersResource,
  TeamsResource,
  UsersResource,
} from './resources/index.js';

import type { HttpClientOptions } from './http.js';

/** Entry point of the SDK: one instance per API origin. */
export class TimeManagerClient {
  /** Sign-in, refresh, sign-out and current user. */
  public readonly auth: AuthResource;
  /** Clock in/out and clock entries. */
  public readonly clocks: ClocksResource;
  /** User and team KPI reports. */
  public readonly reports: ReportsResource;
  /** Membership of teams. */
  public readonly teamMembers: TeamMembersResource;
  /** Teams. */
  public readonly teams: TeamsResource;
  /** Users. */
  public readonly users: UsersResource;

  public constructor(options: HttpClientOptions) {
    const http = new HttpClient(options);
    this.auth = new AuthResource(http);
    this.users = new UsersResource(http);
    this.teams = new TeamsResource(http);
    this.teamMembers = new TeamMembersResource(http);
    this.clocks = new ClocksResource(http);
    this.reports = new ReportsResource(http);
  }
}
