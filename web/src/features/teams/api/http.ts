import type { Page } from '@/features/teams/api/types'

import { createAuthFetch } from '@/lib/api/auth-fetch'
import { API_URL } from '@/lib/api/config'
import { toApiError } from '@/lib/api/errors'
import { getAccessToken, notifyAuthFailure, refreshSession } from '@/lib/auth/session'

const MAX_PAGES = 20

const authFetch = createAuthFetch({
  get_token: getAccessToken,
  on_auth_failure: notifyAuthFailure,
  refresh: refreshSession,
})

export async function fetchAllPages<T>(path: string, body: Record<string, unknown>) {
  const items: T[] = []
  let cursor: string | undefined
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const page = await request<Page<T>>('POST', path, { ...body, cursor, limit: 100 })
    items.push(...page.items)
    if (!page.more || !page.next) break
    cursor = page.next
  }
  return items
}

export async function request<T>(method: string, path: string, body?: unknown) {
  const base = API_URL || window.location.origin
  const response = await authFetch(
    new Request(`${base}${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      method,
    }),
  )
  const payload = (await response.json().catch(() => null)) as unknown
  if (!response.ok) throw toApiError(payload, response.status)
  return (payload as { data: T }).data
}
