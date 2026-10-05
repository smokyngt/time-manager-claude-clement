import { API_URL } from '@/lib/api/config'
import { toApiError } from '@/lib/api/errors'

type Listener = () => void

let access_token: null | string = null
let refresh_promise: null | Promise<string> = null
const failure_listeners = new Set<Listener>()

export function getAccessToken() {
  return access_token
}

export function setAccessToken(token: null | string) {
  access_token = token
}

export function onAuthFailure(listener: Listener) {
  failure_listeners.add(listener)
  return () => {
    failure_listeners.delete(listener)
  }
}

export function notifyAuthFailure() {
  access_token = null
  failure_listeners.forEach((listener) => {
    listener()
  })
}

async function requestRefresh() {
  const response = await fetch(`${API_URL}/v1/auth/refresh`, {
    credentials: 'include',
    method: 'POST',
  })
  const body = (await response.json().catch(() => null)) as unknown
  if (!response.ok) throw toApiError(body, response.status)
  const token = (body as { data?: { access_token?: string } } | null)?.data?.access_token
  if (!token) throw toApiError(null, response.status)
  access_token = token
  return token
}

export function refreshSession() {
  refresh_promise ??= requestRefresh().finally(() => {
    refresh_promise = null
  })
  return refresh_promise
}
