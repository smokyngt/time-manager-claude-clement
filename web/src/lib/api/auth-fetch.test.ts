import { describe, expect, it, vi } from 'vitest'

import { createAuthFetch } from '@/lib/api/auth-fetch'

function makeRequest(path = '/v1/users/list') {
  return new Request(`http://localhost${path}`, { body: '{}', method: 'POST' })
}

function sentRequest(mock: { mock: { calls: Request[][] } }, index: number) {
  const request = mock.mock.calls[index]?.[0]
  if (!request) throw new Error('request not sent')
  return request
}

function authHeader(request: Request) {
  return request.headers.get('Authorization')
}

describe('createAuthFetch', () => {
  it('adds the bearer token', async () => {
    const base_fetch = vi.fn<(request: Request) => Promise<Response>>(() =>
      Promise.resolve(new Response('{}')),
    )
    const authFetch = createAuthFetch({
      base_fetch,
      get_token: () => 'abc',
      on_auth_failure: vi.fn(),
      refresh: vi.fn(),
    })

    await authFetch(makeRequest())

    expect(authHeader(sentRequest(base_fetch, 0))).toBe('Bearer abc')
  })

  it('refreshes once and retries with the new token on 401', async () => {
    const base_fetch = vi
      .fn<(request: Request) => Promise<Response>>()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }))
    const refresh = vi.fn(() => Promise.resolve('fresh'))
    const on_auth_failure = vi.fn()
    const authFetch = createAuthFetch({
      base_fetch,
      get_token: () => 'old',
      on_auth_failure,
      refresh,
    })

    const response = await authFetch(makeRequest())

    expect(response.status).toBe(200)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(base_fetch).toHaveBeenCalledTimes(2)
    expect(authHeader(sentRequest(base_fetch, 1))).toBe('Bearer fresh')
    expect(await sentRequest(base_fetch, 1).text()).toBe('{}')
    expect(on_auth_failure).not.toHaveBeenCalled()
  })

  it('calls on_auth_failure and returns the 401 when refresh fails', async () => {
    const base_fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 401 })))
    const on_auth_failure = vi.fn()
    const authFetch = createAuthFetch({
      base_fetch,
      get_token: () => 'old',
      on_auth_failure,
      refresh: () => Promise.reject(new Error('expired')),
    })

    const response = await authFetch(makeRequest())

    expect(response.status).toBe(401)
    expect(on_auth_failure).toHaveBeenCalledTimes(1)
    expect(base_fetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry more than once', async () => {
    const base_fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 401 })))
    const refresh = vi.fn(() => Promise.resolve('fresh'))
    const authFetch = createAuthFetch({
      base_fetch,
      get_token: () => 'old',
      on_auth_failure: vi.fn(),
      refresh,
    })

    const response = await authFetch(makeRequest())

    expect(response.status).toBe(401)
    expect(base_fetch).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('skips refresh handling for login', async () => {
    const base_fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 401 })))
    const refresh = vi.fn()
    const authFetch = createAuthFetch({
      base_fetch,
      get_token: () => null,
      on_auth_failure: vi.fn(),
      refresh,
    })

    const response = await authFetch(makeRequest('/v1/auth/login'))

    expect(response.status).toBe(401)
    expect(refresh).not.toHaveBeenCalled()
  })
})
