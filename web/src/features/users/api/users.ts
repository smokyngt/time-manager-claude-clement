import type {
  BulkResult,
  UserCreateInput,
  UserFilters,
  UserUpdateData,
} from '@/features/users/types'

import { usersApi } from '@/features/users/api/client'
import { toApiError } from '@/lib/api/errors'

export const USERS_PAGE_SIZE = 25

export async function archiveUser(id: string) {
  const { data, error, response } = await usersApi.POST('/v1/users/{id}/archive', {
    params: { path: { id } },
  })
  if (error) throw toApiError(error, response.status)
  return data.data
}

export async function archiveUsers(ids: string[]): Promise<BulkResult> {
  return runEach(ids, archiveUser)
}

export async function createUser(body: UserCreateInput) {
  const { data, error, response } = await usersApi.POST('/v1/users/new', { body })
  if (error) throw toApiError(error, response.status)
  return data.data
}

export async function deleteUsers(ids: string[]): Promise<BulkResult> {
  const { data, error, response } = await usersApi.DELETE('/v1/users', { body: { ids } })
  if (error) throw toApiError(error, response.status)
  return { failed: data.data.failed, succeeded: data.data.deleted }
}

export async function getUser(id: string) {
  const { data, error, response } = await usersApi.GET('/v1/users/{id}', {
    params: { path: { id } },
  })
  if (error) throw toApiError(error, response.status)
  return data.data
}

export async function listUsers(filters: UserFilters, cursor?: string) {
  const { data, error, response } = await usersApi.POST('/v1/users/list', {
    body: {
      archived: filters.archived,
      cursor,
      limit: USERS_PAGE_SIZE,
      role: filters.role === 'all' ? undefined : filters.role,
    },
  })
  if (error) throw toApiError(error, response.status)
  return data.data
}

export async function restoreUser(id: string) {
  const { data, error, response } = await usersApi.POST('/v1/users/{id}/restore', {
    params: { path: { id } },
  })
  if (error) throw toApiError(error, response.status)
  return data.data
}

export async function restoreUsers(ids: string[]): Promise<BulkResult> {
  return runEach(ids, restoreUser)
}

export async function updateUsers(ids: string[], data: UserUpdateData): Promise<BulkResult> {
  const result = await usersApi.PATCH('/v1/users', { body: { data, ids } })
  if (result.error) throw toApiError(result.error, result.response.status)
  return { failed: result.data.data.failed, succeeded: result.data.data.updated }
}

async function runEach(ids: string[], action: (id: string) => Promise<unknown>) {
  const settled = await Promise.allSettled(ids.map((id) => action(id)))
  const result: BulkResult = { failed: [], succeeded: [] }
  settled.forEach((outcome, index) => {
    const id = ids[index]
    if (id === undefined) return
    if (outcome.status === 'fulfilled') {
      result.succeeded.push(id)
      return
    }
    result.failed.push({ code: toApiError(outcome.reason).code, id })
  })
  return result
}
