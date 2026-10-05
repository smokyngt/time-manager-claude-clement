import { NetworkError, RateLimitError, TimeManagerError } from '@time-manager/sdk'

import { i18n } from '@/lib/i18n'

const MAX_RETRY_AFTER_SECONDS = 3600

export class Errors {
  static readonly code = {
    /**
     * @route client.lib.errors.code.check
     * @param {unknown} error
     * @param {string} code Dotted API code, for example `clock.conflict`.
     * @returns {boolean}
     */
    check(error: unknown, code: string): boolean {
      return error instanceof TimeManagerError && error.code === code
    },
  }

  /**
   * @route client.lib.errors.isAuth
   * @param {unknown} error
   * @returns {boolean}
   */
  static isAuth(error: unknown): boolean {
    return error instanceof TimeManagerError && error.status === 401
  }

  /**
   * @route client.lib.errors.retryable
   * @param {unknown} error
   * @returns {boolean} True for network failures, 5xx and 429.
   */
  static retryable(error: unknown): boolean {
    if (error instanceof NetworkError) {
      return true
    }
    return error instanceof TimeManagerError && (error.status >= 500 || error.status === 429)
  }

  /**
   * @route client.lib.errors.translate
   * @param {unknown} error
   * @returns {string} User-facing text in the active language, never a raw message.
   */
  static translate(error: unknown): string {
    if (error instanceof NetworkError) {
      return i18n.t(error.isTimeout ? 'errors:timeout' : 'errors:network')
    }
    if (error instanceof RateLimitError) {
      const seconds = Math.min(error.retryAfter ?? 0, MAX_RETRY_AFTER_SECONDS)
      if (seconds > 0) {
        return i18n.t('errors:rate_limited', { seconds: Math.ceil(seconds) })
      }
    }
    if (error instanceof TimeManagerError) {
      const key = `errors:${error.code}`
      if (i18n.exists(key)) {
        return i18n.t(key)
      }
    }
    return i18n.t('errors:generic')
  }
}
