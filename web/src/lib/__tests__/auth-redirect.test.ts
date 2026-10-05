import { afterEach, describe, expect, it } from 'vitest'

import { AuthRedirect } from '@/lib/auth-redirect'

describe('AuthRedirect', () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it('only keeps same-app, non-auth paths', () => {
    expect(AuthRedirect.sanitize('/teams?x=1')).toBe('/teams?x=1')
    expect(AuthRedirect.sanitize('//evil.com')).toBe('/')
    expect(AuthRedirect.sanitize('https://evil.com')).toBe('/')
    expect(AuthRedirect.sanitize('/login')).toBe('/')
    expect(AuthRedirect.sanitize('/auth/callback')).toBe('/')
    expect(AuthRedirect.sanitize(null)).toBe('/')
  })

  it('builds the login url', () => {
    expect(AuthRedirect.loginUrl('/teams?page=2')).toBe('/login?redirect=%2Fteams%3Fpage%3D2')
    expect(AuthRedirect.loginUrl('/')).toBe('/login')
    expect(AuthRedirect.loginUrl('/login')).toBe('/login')
  })

  it('stores and consumes the target once', () => {
    AuthRedirect.store('/users')
    expect(AuthRedirect.peek()).toBe('/users')
    expect(AuthRedirect.consume()).toBe('/users')
    expect(AuthRedirect.consume()).toBe('/')
  })
})
