import type { HttpClient } from '../http.js';
import type {
  ListResponse,
  TeamMember,
  TeamMemberListParams,
  TeamMembersAddResponse,
  TeamMembersRemoveResponse,
} from '../types.js';

/** Team membership endpoints (`/v1/teams/:id/members`). */
export class TeamMembersResource {
  public constructor(private readonly http: HttpClient) {}

  /** Adds users to a team. */
  public add(teamId: string, userIds: string[]): Promise<TeamMembersAddResponse> {
    return this.http.post<TeamMembersAddResponse>(`/v1/teams/${teamId}/members/add`, { userIds });
  }

  /** Lists the members of a team. */
  public list(teamId: string, params: TeamMemberListParams = {}): Promise<ListResponse<TeamMember>> {
    return this.http.post<ListResponse<TeamMember>>(`/v1/teams/${teamId}/members/list`, params);
  }

  /** Removes users from a team. */
  public remove(teamId: string, userIds: string[]): Promise<TeamMembersRemoveResponse> {
    return this.http.post<TeamMembersRemoveResponse>(`/v1/teams/${teamId}/members/remove`, {
      userIds,
    });
  }
}
