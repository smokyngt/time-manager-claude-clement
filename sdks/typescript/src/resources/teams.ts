import type { HttpClient } from '../http.js';
import type {
  ArchiveTeamResponse,
  BulkDeleteResponse,
  BulkUpdateResponse,
  CreateTeamResponse,
  ListResponse,
  RestoreTeamResponse,
  RetrieveTeamResponse,
  Team,
  TeamCreateParams,
  TeamListParams,
  TeamUpdateData,
} from '../types.js';

/** Team endpoints (`/v1/teams`). */
export class TeamsResource {
  public constructor(private readonly http: HttpClient) {}

  /** Archives a team. */
  public archive(id: string): Promise<ArchiveTeamResponse> {
    return this.http.post<ArchiveTeamResponse>(`/v1/teams/${id}/archive`);
  }

  /** Creates a team. */
  public create(params: TeamCreateParams): Promise<CreateTeamResponse> {
    return this.http.post<CreateTeamResponse>('/v1/teams/new', params);
  }

  /** Deletes teams permanently. */
  public delete(ids: string[]): Promise<BulkDeleteResponse> {
    return this.http.delete<BulkDeleteResponse>('/v1/teams', { ids });
  }

  /** Lists teams with filters and cursor pagination. */
  public list(params: TeamListParams = {}): Promise<ListResponse<Team>> {
    return this.http.post<ListResponse<Team>>('/v1/teams/list', params);
  }

  /** Restores an archived team. */
  public restore(id: string): Promise<RestoreTeamResponse> {
    return this.http.post<RestoreTeamResponse>(`/v1/teams/${id}/restore`);
  }

  /** Retrieves one team. */
  public retrieve(id: string): Promise<RetrieveTeamResponse> {
    return this.http.get<RetrieveTeamResponse>(`/v1/teams/${id}`);
  }

  /** Applies the same changes to several teams. */
  public update(ids: string[], data: TeamUpdateData): Promise<BulkUpdateResponse> {
    return this.http.patch<BulkUpdateResponse>('/v1/teams', { data, ids });
  }
}
