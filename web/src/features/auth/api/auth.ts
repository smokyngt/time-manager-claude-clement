import type { components } from '@/lib/api/schema'
import type { SessionData } from '@/lib/auth/session'

import { api } from '@/lib/api/client'
import { toApiError } from '@/lib/api/errors'

export type Role = components['schemas']['Role']
export type User = components['schemas']['User']

export async function fetchMe() {
  const { data, error, response } = await api.GET('/v1/auth/me')
  if (error) throw toApiError(error, response.status)
  return data.data
}

export async function loginRequest(body: components['schemas']['Login']): Promise<SessionData> {
  const { data, error, response } = await api.POST('/v1/auth/login', { body })
  if (error) throw toApiError(error, response.status)
  const { access_token, expires_in, user } = data.data
  return { access_token, expires_in, user }
}

/** Revokes the refresh cookie (sent via `credentials: 'include'` on the api client). */
export async function logoutRequest() {
  const { error, response } = await api.POST('/v1/auth/logout')
  if (error) throw toApiError(error, response.status)
}
