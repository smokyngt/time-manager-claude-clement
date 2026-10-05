import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { TestAuth } from '@/test-support/test-auth'

const captured = vi.hoisted(() => ({
  options: undefined as Record<string, (...args: never[]) => unknown> | undefined,
}))

vi.mock('@time-manager/sdk', () => ({
  TimeManagerClient: vi.fn(function TimeManagerClient(
    options: Record<string, (...args: never[]) => unknown>,
  ) {
    captured.options = options
  }),
}))

describe('sdk', () => {
  beforeEach(async () => {
    await import('@/config/sdk')
    useAuthStore.getState().clear()
  })

  it('reads the token from the auth store', () => {
    useAuthStore.getState().setToken('abc')
    expect(captured.options?.getToken?.()).toBe('abc')
  })

  it('writes refreshed sessions to the store', () => {
    const user = TestAuth.user()
    ;(captured.options?.onTokenRefresh as (token: string, session: unknown) => void)('new', {
      scopes: ['teams:read'],
      user,
    })
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'new',
      scopes: ['teams:read'],
      user,
    })
  })

  it('clears the store and redirects to login after a lost session', () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { assign, hash: '', pathname: '/teams', search: '?page=2' })
    useAuthStore.getState().setToken('abc')
    captured.options?.onLogout?.()
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(assign).toHaveBeenCalledWith('/login?redirect=%2Fteams%3Fpage%3D2')
    vi.unstubAllGlobals()
  })

  it('does not redirect when there was no session (boot refresh failing)', () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { assign, hash: '', pathname: '/teams', search: '' })
    captured.options?.onLogout?.()
    expect(assign).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
