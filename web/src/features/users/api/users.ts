import type { components } from '@/lib/api/schema'

import { api } from '@/lib/api/client'
import { toApiError } from '@/lib/api/errors'

export type CreateUserBody = components['schemas']['CreateUserBody']

export async function createUser(body: CreateUserBody) {
  const { data, error, response } = await api.POST('/v1/users/new', { body })
  if (error) throw toApiError(error, response.status)
  return data.data
}

export async function listUsers() {
  const { data, error, response } = await api.POST('/v1/users/list', { body: {} })
  if (error) throw toApiError(error, response.status)
  return data.data
}
