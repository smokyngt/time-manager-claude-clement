import type { HttpClient } from '../http.js';
import type {
  BulkDeleteResponse,
  BulkUpdateResponse,
  ListResponse,
  Team,
  TeamCreateParams,
  TeamListParams,
  TeamUpdateData,
} from '../types.js';

/** Team endpoints (`/v1/teams`). */
export class TeamsResource {
  public constructor(private readonly http: HttpClient) {}

  /** Archives a team. */
  public async archive(id: string): Promise<Team> {
    return (await this.http.post<{ team: Team }>(`/v1/teams/${id}/archive`)).team;
  }

  /** Creates a team. */
  public async create(params: TeamCreateParams): Promise<Team> {
    return (await this.http.post<{ team: Team }>('/v1/teams/new', params)).team;
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
  public async restore(id: string): Promise<Team> {
    return (await this.http.post<{ team: Team }>(`/v1/teams/${id}/restore`)).team;
  }

  /** Retrieves one team. */
  public async retrieve(id: string): Promise<Team> {
    return (await this.http.get<{ team: Team }>(`/v1/teams/${id}`)).team;
  }

  /** Applies the same changes to several teams. */
  public update(ids: string[], data: TeamUpdateData): Promise<BulkUpdateResponse> {
    return this.http.patch<BulkUpdateResponse>('/v1/teams', { data, ids });
  }
}
