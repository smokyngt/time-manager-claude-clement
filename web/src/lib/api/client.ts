import createClient from 'openapi-fetch'

import type { paths } from '@/lib/api/schema'

import { createAuthFetch } from '@/lib/api/auth-fetch'
import { API_URL } from '@/lib/api/config'
import { getAccessToken, notifyAuthFailure, refreshSession } from '@/lib/auth/session'

const authFetch = createAuthFetch({
  get_token: getAccessToken,
  on_auth_failure: notifyAuthFailure,
  refresh: refreshSession,
})

export const api = createClient<paths>({
  baseUrl: API_URL || window.location.origin,
  credentials: 'include',
  fetch: authFetch,
})
