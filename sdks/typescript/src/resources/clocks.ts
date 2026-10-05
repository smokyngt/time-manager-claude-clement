import type { HttpClient } from '../http.js';
import type {
  BulkDeleteResponse,
  BulkUpdateResponse,
  ClockInResponse,
  ClockCreateParams,
  ClockListParams,
  ClockNoteParams,
  ClockOutResponse,
  ClockUpdateData,
  CreateClockResponse,
  CurrentClockResponse,
  ListResponse,
  RetrieveClockResponse,
} from '../types.js';

/** Clock endpoints (`/v1/clocks`). */
export class ClocksResource {
  public constructor(private readonly http: HttpClient) {}

  /** Creates a manual clock entry. */
  public create(params: ClockCreateParams): Promise<CreateClockResponse> {
    return this.http.post<CreateClockResponse>('/v1/clocks/new', params);
  }

  /** Returns the open clock of the caller, null when clocked out. */
  public current(): Promise<CurrentClockResponse> {
    return this.http.get<CurrentClockResponse>('/v1/clocks/current');
  }

  /** Deletes clocks permanently. */
  public delete(ids: string[]): Promise<BulkDeleteResponse> {
    return this.http.delete<BulkDeleteResponse>('/v1/clocks', { ids });
  }

  /** Clocks the caller in. */
  public in(params: ClockNoteParams = {}): Promise<ClockInResponse> {
    return this.http.post<ClockInResponse>('/v1/clocks/in', params);
  }

  /** Lists clocks with filters and cursor pagination. */
  public list(params: ClockListParams = {}): Promise<ListResponse<Clock>> {
    return this.http.post<ListResponse<Clock>>('/v1/clocks/list', params);
  }

  /** Clocks the caller out. */
  public out(params: ClockNoteParams = {}): Promise<ClockOutResponse> {
    return this.http.post<ClockOutResponse>('/v1/clocks/out', params);
  }

  /** Retrieves one clock. */
  public retrieve(id: string): Promise<RetrieveClockResponse> {
    return this.http.get<RetrieveClockResponse>(`/v1/clocks/${id}`);
  }

  /** Applies the same corrections to several clocks. */
  public update(ids: string[], data: ClockUpdateData): Promise<BulkUpdateResponse> {
    return this.http.patch<BulkUpdateResponse>('/v1/clocks', { data, ids });
  }
}
