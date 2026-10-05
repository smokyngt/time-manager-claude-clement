import type { components } from '@/lib/api/schema'

import { api } from '@/lib/api/client'
import { toApiError } from '@/lib/api/errors'

export type Role = components['schemas']['Role']
export type User = components['schemas']['User']

export async function fetchMe() {
  const { data, error, response } = await api.GET('/v1/auth/me')
  if (error) throw toApiError(error, response.status)
  return data.data
}

export async function loginRequest(body: components['schemas']['Login']) {
  const { data, error, response } = await api.POST('/v1/auth/login', { body })
  if (error) throw toApiError(error, response.status)
  return data.data.access_token
}

export async function logoutRequest() {
  await api.POST('/v1/auth/logout')
}
