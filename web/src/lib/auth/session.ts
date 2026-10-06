import type { User } from '@time-manager/sdk'

import { API_URL } from '@/lib/api/config'
import { toApiError } from '@/lib/api/errors'

type Listener = () => void

export interface SessionData {
  access_token: string
  expires_in: number
  user: User
}

type SessionListener = (session: SessionData) => void

/** Refresh this many seconds before the access token expires. */
export const REFRESH_LEEWAY_SECONDS = 60

let access_token: null | string = null
let refresh_promise: null | Promise<string> = null
let refresh_timer: null | ReturnType<typeof setTimeout> = null
const failure_listeners = new Set<Listener>()
const session_listeners = new Set<SessionListener>()

export function getAccessToken() {
  return access_token
}

export function setAccessToken(token: null | string) {
  access_token = token
  if (token === null) clearRefreshTimer()
}

export function onAuthFailure(listener: Listener) {
  failure_listeners.add(listener)
  return () => {
    failure_listeners.delete(listener)
  }
}

/** Called whenever a refresh succeeds (boot, timer, or 401 retry). */
export function onSessionRefreshed(listener: SessionListener) {
  session_listeners.add(listener)
  return () => {
    session_listeners.delete(listener)
  }
}

export function notifyAuthFailure() {
  access_token = null
  clearRefreshTimer()
  failure_listeners.forEach((listener) => {
    listener()
  })
}

export function clearRefreshTimer() {
  if (refresh_timer !== null) clearTimeout(refresh_timer)
  refresh_timer = null
}

/** Schedule a proactive refresh ~60s before expiry (half the lifetime for very short tokens). */
export function scheduleRefresh(expires_in: number) {
  clearRefreshTimer()
  const lead = expires_in > REFRESH_LEEWAY_SECONDS * 2 ? REFRESH_LEEWAY_SECONDS : expires_in / 2
  const delay_ms = Math.max(0, (expires_in - lead) * 1000)
  refresh_timer = setTimeout(() => {
    refresh_timer = null
    refreshSession().catch(() => {
      notifyAuthFailure()
    })
  }, delay_ms)
}

/** Store a session obtained from login or refresh and arm the refresh timer. */
export function applySession(session: SessionData) {
  access_token = session.access_token
  scheduleRefresh(session.expires_in)
  session_listeners.forEach((listener) => {
    listener(session)
  })
}

async function requestRefresh() {
  const response = await fetch(`${API_URL}/v1/auth/refresh`, {
    credentials: 'include',
    method: 'POST',
  })
  const body = (await response.json().catch(() => null)) as unknown
  if (!response.ok) throw toApiError(body, response.status)
  const data = (body as { data?: Partial<SessionData> } | null)?.data
  if (!data?.access_token) throw toApiError(null, response.status)
  if (typeof data.expires_in === 'number' && data.user) {
    applySession({ access_token: data.access_token, expires_in: data.expires_in, user: data.user })
  } else {
    access_token = data.access_token
  }
  return data.access_token
}

export function refreshSession() {
  refresh_promise ??= requestRefresh().finally(() => {
    refresh_promise = null
  })
  return refresh_promise
}
