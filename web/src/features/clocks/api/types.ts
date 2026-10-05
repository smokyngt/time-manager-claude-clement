import type { components } from '@/lib/api/schema'

export interface BulkDeleteResult {
  deleted: string[]
  failed: BulkFailure[]
  success: boolean
}

export interface BulkFailure {
  id: string
  message?: string
  reason?: string
}

export interface BulkUpdateResult {
  failed: BulkFailure[]
  success: boolean
  updated: string[]
}

export interface Clock {
  clocked_in_at: number
  clocked_out_at: null | number
  created_at: number
  duration_ms: null | number
  id: string
  note: null | string
  object: 'clock'
  source: ClockSource
  updated_at: null | number
  user_id: string
}

export interface ClockListBody {
  cursor?: string
  from?: number
  limit?: number
  open?: boolean
  order?: ClockOrder
  to?: number
  user_ids?: string[]
}

export interface ClockNoteBody {
  note?: string
}

export interface ClockPage {
  items: Clock[]
  more: boolean
  next: null | string
  total: number
}

export type ClockOrder = 'asc' | 'desc'

export interface ClockPaths {
  '/v1/clocks': {
    delete: {
      requestBody: Body<{ ids: string[] }>
      responses: { 200: Envelope<BulkDeleteResult>; 403: ErrorJson }
    }
    patch: {
      requestBody: Body<{ data: UpdateClockData; ids: string[] }>
      responses: { 200: Envelope<BulkUpdateResult>; 403: ErrorJson; 409: ErrorJson }
    }
  }
  '/v1/clocks/current': {
    get: { responses: { 200: Envelope<{ clock: Clock | null }>; 401: ErrorJson } }
  }
  '/v1/clocks/in': {
    post: {
      requestBody?: Body<ClockNoteBody>
      responses: { 200: Envelope<Clock>; 201: Envelope<Clock>; 409: ErrorJson }
    }
  }
  '/v1/clocks/list': {
    post: {
      requestBody?: Body<ClockListBody>
      responses: { 200: Envelope<ClockPage>; 403: ErrorJson }
    }
  }
  '/v1/clocks/new': {
    post: {
      requestBody: Body<CreateClockBody>
      responses: { 200: Envelope<Clock>; 201: Envelope<Clock>; 403: ErrorJson; 409: ErrorJson }
    }
  }
  '/v1/clocks/out': {
    post: {
      requestBody?: Body<ClockNoteBody>
      responses: { 200: Envelope<Clock>; 201: Envelope<Clock>; 409: ErrorJson }
    }
  }
}

export type ClockSource = 'clock' | 'manual'

export interface CreateClockBody {
  clocked_in_at: number
  clocked_out_at: number
  note?: string
  user_id: string
}

export interface UpdateClockData {
  clocked_in_at?: number
  clocked_out_at?: number
  note?: null | string
}

type Body<T> = { content: { 'application/json': T } }
type Envelope<T> = Json<{ data: T; event: null | string }>
type ErrorJson = Json<components['schemas']['ApiError']>
type Json<T> = { content: { 'application/json': T }; headers: Record<string, unknown> }
