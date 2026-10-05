import {
  AuthenticationError,
  NetworkError,
  RateLimitError,
  ServerError,
  TimeManagerError,
} from '@time-manager/sdk'
import { beforeAll, describe, expect, it } from 'vitest'

import { Errors } from '@/lib/errors'
import { i18n } from '@/lib/i18n'

function api(code: string, status: number) {
  return new TimeManagerError({ code, status })
}

describe('Errors', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en')
  })

  describe('translate', () => {
    it('translates API codes', () => {
      expect(Errors.translate(api('team.not.found', 404))).toBe('This team no longer exists.')
    })

    it('translates in the active language', async () => {
      await i18n.changeLanguage('fr')
      expect(Errors.translate(api('team.not.found', 404))).toBe("Cette équipe n'existe plus.")
      await i18n.changeLanguage('en')
    })

    it('falls back to generic for unknown codes and foreign errors', () => {
      expect(Errors.translate(api('nope.unknown', 418))).toBe(
        'Something went wrong. Please try again.',
      )
      expect(Errors.translate(new Error('boom'))).toBe('Something went wrong. Please try again.')
      expect(Errors.translate('x')).toBe('Something went wrong. Please try again.')
    })

    it('never leaks raw messages', () => {
      const error = new TimeManagerError({
        code: 'nope',
        message: 'SELECT * FROM users',
        status: 500,
      })
      expect(Errors.translate(error)).not.toContain('SELECT')
    })

    it('distinguishes network and timeout failures', () => {
      expect(Errors.translate(new NetworkError({}))).toContain('Cannot reach the server')
      expect(Errors.translate(new NetworkError({ isTimeout: true }))).toContain('too long')
    })

    it('shows the retry delay of rate limits', () => {
      const error = new RateLimitError({ code: 'rate.limit.exceeded', retryAfter: 12, status: 429 })
      expect(Errors.translate(error)).toBe('Too many requests. Try again in 12 seconds.')
    })

    it('uses the rate limit code text without a delay', () => {
      const error = new RateLimitError({ code: 'rate.limit.exceeded', status: 429 })
      expect(Errors.translate(error)).toBe('Too many requests. Please wait a moment and try again.')
    })
  })

  describe('retryable', () => {
    it('retries network failures, 5xx and 429', () => {
      expect(Errors.retryable(new NetworkError({}))).toBe(true)
      expect(Errors.retryable(new ServerError({ code: 'internal.unexpected', status: 500 }))).toBe(
        true,
      )
      expect(
        Errors.retryable(new RateLimitError({ code: 'rate.limit.exceeded', status: 429 })),
      ).toBe(true)
    })

    it('does not retry client errors or foreign errors', () => {
      expect(Errors.retryable(api('team.not.found', 404))).toBe(false)
      expect(Errors.retryable(new Error('x'))).toBe(false)
    })
  })

  describe('code.check', () => {
    it('matches the code of an SDK error only', () => {
      expect(Errors.code.check(api('clock.conflict', 409), 'clock.conflict')).toBe(true)
      expect(Errors.code.check(api('clock.conflict', 409), 'clock.overlap')).toBe(false)
      expect(Errors.code.check(new Error('clock.conflict'), 'clock.conflict')).toBe(false)
    })
  })

  describe('isAuth', () => {
    it('detects 401 errors', () => {
      expect(
        Errors.isAuth(
          new AuthenticationError({ code: 'token.authentication.failed', status: 401 }),
        ),
      ).toBe(true)
      expect(Errors.isAuth(api('unauthorized', 403))).toBe(false)
    })
  })
})
