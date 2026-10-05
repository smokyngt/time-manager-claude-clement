import type { HttpClient } from '../http.js';
import type {
  BulkDeleteResponse,
  BulkUpdateResponse,
  ListResponse,
  User,
  UserCreateParams,
  UserListParams,
  UserUpdateData,
} from '../types.js';

/** User endpoints (`/v1/users`). */
export class UsersResource {
  public constructor(private readonly http: HttpClient) {}

  /** Archives a user. */
  public async archive(id: string): Promise<User> {
    return (await this.http.post<{ user: User }>(`/v1/users/${id}/archive`)).user;
  }

  /** Creates a user. */
  public async create(params: UserCreateParams): Promise<User> {
    return (await this.http.post<{ user: User }>('/v1/users/new', params)).user;
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
  public async restore(id: string): Promise<User> {
    return (await this.http.post<{ user: User }>(`/v1/users/${id}/restore`)).user;
  }

  /** Retrieves one user. */
  public async retrieve(id: string): Promise<User> {
    return (await this.http.get<{ user: User }>(`/v1/users/${id}`)).user;
  }

  /** Applies the same changes to several users. */
  public update(ids: string[], data: UserUpdateData): Promise<BulkUpdateResponse> {
    return this.http.patch<BulkUpdateResponse>('/v1/users', { data, ids });
  }
}
