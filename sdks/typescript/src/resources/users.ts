import type { HttpClient } from '../http.js';
import type {
  ArchiveUserResponse,
  BulkDeleteResponse,
  BulkUpdateResponse,
  CreateUserResponse,
  ListResponse,
  RestoreUserResponse,
  RetrieveUserResponse,
  User,
  UserCreateParams,
  UserListParams,
  UserUpdateData,
} from '../types.js';

/** User endpoints (`/v1/users`). */
export class UsersResource {
  public constructor(private readonly http: HttpClient) {}

  /** Archives a user. */
  public archive(id: string): Promise<ArchiveUserResponse> {
    return this.http.post<ArchiveUserResponse>(`/v1/users/${id}/archive`);
  }

  /** Creates a user. */
  public create(params: UserCreateParams): Promise<CreateUserResponse> {
    return this.http.post<CreateUserResponse>('/v1/users/new', params);
  }

  /** Deletes users permanently. */
  public delete(ids: string[]): Promise<BulkDeleteResponse> {
    return this.http.delete<BulkDeleteResponse>('/v1/users', { ids });
  }

  /** Lists users with filters and cursor pagination. */
  public list(params: UserListParams = {}): Promise<ListResponse<User>> {
    return this.http.post<ListResponse<User>>('/v1/users/list', params);
  }

  /** Restores an archived user. */
  public restore(id: string): Promise<RestoreUserResponse> {
    return this.http.post<RestoreUserResponse>(`/v1/users/${id}/restore`);
  }

  /** Retrieves one user. */
  public retrieve(id: string): Promise<RetrieveUserResponse> {
    return this.http.get<RetrieveUserResponse>(`/v1/users/${id}`);
  }

  /** Applies the same changes to several users. */
  public update(ids: string[], data: UserUpdateData): Promise<BulkUpdateResponse> {
    return this.http.patch<BulkUpdateResponse>('/v1/users', { data, ids });
  }
}
