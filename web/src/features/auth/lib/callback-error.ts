import { ErrorCodes } from '@time-manager/sdk'

const KNOWN_CODES: readonly string[] = [
  ErrorCodes.AuthMicrosoftFailed,
  ErrorCodes.AuthMicrosoftRejected,
  ErrorCodes.AuthMicrosoftUnavailable,
  ErrorCodes.AuthMicrosoftUnknownUser,
]

export class CallbackError {
  /**
   * @route client.features.auth.callbackError.key
   * @param {null | string} code Value of the `error` search parameter.
   * @returns {string} Translation key in the `errors` namespace.
   */
  static key(code: null | string): string {
    if (code !== null && KNOWN_CODES.includes(code)) {
      return `errors:${code}`
    }
    return `errors:${ErrorCodes.AuthMicrosoftFailed}`
  }
}
