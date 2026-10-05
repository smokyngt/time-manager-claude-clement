import type { components } from '@/lib/api/schema'

export type ApiErrorBody = components['schemas']['ApiError']

export class ApiError extends Error {
  code: string
  request_id: string
  status: number

  constructor(body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.code = body.code
    this.request_id = body.request_id
    this.status = body.status
  }
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof value.message === 'string' &&
    'status' in value &&
    typeof value.status === 'number'
  )
}

export function toApiError(error: unknown, fallback_status = 0) {
  if (isApiErrorBody(error)) return new ApiError(error)
  return new ApiError({
    code: 'unknown_error',
    message: 'Something went wrong. Please try again.',
    request_id: '',
    status: fallback_status,
  })
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}
