import type { HttpClient } from '../http.js';
import type {
  BulkDeleteResponse,
  BulkUpdateResponse,
  Clock,
  ClockCreateParams,
  ClockListParams,
  ClockNoteParams,
  ClockUpdateData,
  ListResponse,
} from '../types.js';

/** Clock endpoints (`/v1/clocks`). */
export class ClocksResource {
  public constructor(private readonly http: HttpClient) {}

  /** Creates a manual clock entry. */
  public async create(params: ClockCreateParams): Promise<Clock> {
    return (await this.http.post<{ clock: Clock }>('/v1/clocks/new', params)).clock;
  }

  /** Returns the open clock of the caller, null when clocked out. */
  public async current(): Promise<Clock | null> {
    return (await this.http.get<{ clock: Clock | null }>('/v1/clocks/current')).clock;
  }

  /** Deletes clocks permanently. */
  public delete(ids: string[]): Promise<BulkDeleteResponse> {
    return this.http.delete<BulkDeleteResponse>('/v1/clocks', { ids });
  }

  /** Clocks the caller in. */
  public async in(params: ClockNoteParams = {}): Promise<Clock> {
    return (await this.http.post<{ clock: Clock }>('/v1/clocks/in', params)).clock;
  }

  /** Lists clocks with filters and cursor pagination. */
  public list(params: ClockListParams = {}): Promise<ListResponse<Clock>> {
    return this.http.post<ListResponse<Clock>>('/v1/clocks/list', params);
  }

  /** Clocks the caller out. */
  public async out(params: ClockNoteParams = {}): Promise<Clock> {
    return (await this.http.post<{ clock: Clock }>('/v1/clocks/out', params)).clock;
  }

  /** Retrieves one clock. */
  public async retrieve(id: string): Promise<Clock> {
    return (await this.http.get<{ clock: Clock }>(`/v1/clocks/${id}`)).clock;
  }

  /** Applies the same corrections to several clocks. */
  public update(ids: string[], data: ClockUpdateData): Promise<BulkUpdateResponse> {
    return this.http.patch<BulkUpdateResponse>('/v1/clocks', { data, ids });
  }
}
