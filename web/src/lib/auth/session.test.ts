import { afterEach, describe, expect, it, vi } from 'vitest'

import { getAccessToken, refreshSession } from '@/lib/auth/session'

describe('refreshSession', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('dedupes concurrent refreshes and stores the token', async () => {
    const fetch_mock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: { access_token: 'tok' }, event: null }), {
          status: 200,
        }),
      ),
    )
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
