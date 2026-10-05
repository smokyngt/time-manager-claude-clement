import { beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { TestAuth } from '@/test-support/test-auth'

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().clear()
  })

  it('starts empty', () => {
    expect(useAuthStore.getState()).toMatchObject({ accessToken: null, scopes: [], user: null })
  })

  it('stores a session and keeps the token in memory only', () => {
    const user = TestAuth.user()
    useAuthStore.getState().setSession({ accessToken: 'tok', scopes: ['teams:read'], user })
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'tok',
      scopes: ['teams:read'],
      user,
    })
    expect(
      JSON.stringify(Object.keys(localStorage).map((key) => localStorage.getItem(key))),
    ).not.toContain('tok')
    expect(
      JSON.stringify(Object.keys(sessionStorage).map((key) => sessionStorage.getItem(key))),
    ).not.toContain('tok')
  })

  it('updates the token and the user separately', () => {
    useAuthStore.getState().setSession({ accessToken: 'a', scopes: [], user: TestAuth.user() })
    useAuthStore.getState().setToken('b')
    useAuthStore.getState().setUser(TestAuth.user({ firstName: 'Ann' }))
    expect(useAuthStore.getState().accessToken).toBe('b')
    expect(useAuthStore.getState().user?.firstName).toBe('Ann')
  })

  it('clears everything', () => {
    useAuthStore
      .getState()
      .setSession({ accessToken: 'a', scopes: ['auth:self'], user: TestAuth.user() })
    useAuthStore.getState().clear()
    expect(useAuthStore.getState()).toMatchObject({ accessToken: null, scopes: [], user: null })
  })
})
