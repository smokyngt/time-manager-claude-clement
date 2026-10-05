import { describe, expect, it } from 'vitest'

import { CallbackError } from '@/features/auth/lib/callback-error'

describe('CallbackError', () => {
  it('maps known Microsoft codes to errors keys', () => {
    expect(CallbackError.key('auth.microsoft.unknown.user')).toBe(
      'errors:auth.microsoft.unknown.user',
    )
    expect(CallbackError.key('auth.microsoft.rejected')).toBe('errors:auth.microsoft.rejected')
    expect(CallbackError.key('auth.microsoft.unavailable')).toBe(
      'errors:auth.microsoft.unavailable',
    )
  })

  it('falls back to the generic Microsoft failure', () => {
    expect(CallbackError.key('whatever')).toBe('errors:auth.microsoft.failed')
    expect(CallbackError.key(null)).toBe('errors:auth.microsoft.failed')
  })
})
