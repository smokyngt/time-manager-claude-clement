import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  applySession,
  getAccessToken,
  notifyAuthFailure,
  onAuthFailure,
  onSessionRefreshed,
  refreshSession,
  setAccessToken,
} from '@/lib/auth/session'

const user = {
  email: 'a@b.co',
  first_name: 'A',
  id: '1',
  last_name: 'B',
  phone_number: null,
  role: 'employee' as const,
}

function sessionResponse(token: string, expires_in = 900) {
  return new Response(
    JSON.stringify({
      data: { access_token: token, expires_in, token_type: 'Bearer', user },
      event: null,
    }),
    { status: 200 },
  )
}

describe('refreshSession', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('dedupes concurrent refreshes and stores the token', async () => {
    const fetch_mock = vi.fn(() => Promise.resolve(sessionResponse('tok')))
    vi.stubGlobal('fetch', fetch_mock)

    const [first, second] = await Promise.all([refreshSession(), refreshSession()])

    expect(first).toBe('tok')
    expect(second).toBe('tok')
    expect(fetch_mock).toHaveBeenCalledTimes(1)
    expect(getAccessToken()).toBe('tok')
  })

  it('rejects when the refresh fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 401 }))),
    )

    await expect(refreshSession()).rejects.toThrow()
  })
})

describe('proactive refresh', () => {
  afterEach(() => {
    setAccessToken(null)
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('refreshes 60s before expiry, reschedules, and notifies with the user', async () => {
    vi.useFakeTimers()
    const fetch_mock = vi.fn(() => Promise.resolve(sessionResponse('next', 900)))
    vi.stubGlobal('fetch', fetch_mock)
    const seen = vi.fn()
    const unsubscribe = onSessionRefreshed(seen)

    applySession({ access_token: 'first', expires_in: 900, user })
    expect(getAccessToken()).toBe('first')
    seen.mockClear()

    await vi.advanceTimersByTimeAsync(839_000)
    expect(fetch_mock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1_000)
    expect(fetch_mock).toHaveBeenCalledTimes(1)
    expect(fetch_mock.mock.calls[0]).toEqual([
      expect.stringContaining('/v1/auth/refresh'),
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    ])
    expect(getAccessToken()).toBe('next')
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ user }))

    await vi.advanceTimersByTimeAsync(840_000)
    expect(fetch_mock).toHaveBeenCalledTimes(2)
    unsubscribe()
  })

  it('is cleared when the token is cleared (logout)', async () => {
    vi.useFakeTimers()
    const fetch_mock = vi.fn(() => Promise.resolve(sessionResponse('x')))
    vi.stubGlobal('fetch', fetch_mock)

    applySession({ access_token: 'first', expires_in: 900, user })
    setAccessToken(null)
    await vi.advanceTimersByTimeAsync(900_000)

    expect(fetch_mock).not.toHaveBeenCalled()
  })

  it('notifies auth failure when the proactive refresh fails', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 401 }))),
    )
    const failed = vi.fn()
    const unsubscribe = onAuthFailure(failed)

    applySession({ access_token: 'first', expires_in: 100, user })
    await vi.advanceTimersByTimeAsync(60_000)

    expect(failed).toHaveBeenCalledTimes(1)
    unsubscribe()
    notifyAuthFailure()
  })
})
