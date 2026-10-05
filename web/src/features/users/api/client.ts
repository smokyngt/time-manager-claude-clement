import createClient from 'openapi-fetch'

import type { UserCreateInput, UserPage, UserRecord, UserUpdateData } from '@/features/users/types'
import type { ApiErrorBody } from '@/lib/api/errors'

import { createAuthFetch } from '@/lib/api/auth-fetch'
import { API_URL } from '@/lib/api/config'
import { getAccessToken, notifyAuthFailure, refreshSession } from '@/lib/auth/session'

interface BulkFailureBody {
  code: string
  id: string
}

interface Json<T> {
  content: { 'application/json': T }
  headers: Record<string, unknown>
}

type Envelope<T> = Json<{ data: T; event: null | string }>

interface IdParams {
  parameters: { cookie?: never; header?: never; path: { id: string }; query?: never; }
}

interface Operation<Body, Data> {
  requestBody: { content: { 'application/json': Body } }
  responses: { 200: Envelope<Data>; default: Json<ApiErrorBody> }
}

interface IdOperation<Data> extends IdParams {
  responses: { 200: Envelope<Data>; default: Json<ApiErrorBody> }
}

interface UserPaths {
  '/v1/users': {
    delete: Operation<
      { ids: string[] },
      { deleted: string[]; failed: BulkFailureBody[]; success: boolean }
    >
    patch: Operation<
      { data: UserUpdateData; ids: string[] },
      { failed: BulkFailureBody[]; success: boolean; updated: string[] }
    >
  }
  '/v1/users/{id}': { get: IdOperation<UserRecord> }
  '/v1/users/{id}/archive': { post: IdOperation<UserRecord> }
  '/v1/users/{id}/restore': { post: IdOperation<UserRecord> }
  '/v1/users/list': {
    post: Operation<
      {
        archived?: boolean
        created_after?: number
        created_before?: number
        cursor?: string
        limit?: number
        role?: UserRecord['role']
      },
      UserPage
    >
  }
  '/v1/users/new': { post: Operation<UserCreateInput, UserRecord> }
}

const authFetch = createAuthFetch({
  get_token: getAccessToken,
  on_auth_failure: notifyAuthFailure,
  refresh: refreshSession,
})

export const usersApi = createClient<UserPaths>({
  baseUrl: API_URL || window.location.origin,
  credentials: 'include',
  fetch: authFetch,
})
