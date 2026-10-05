const AUTH_PATHS = ['/login', '/auth/']
const STORAGE_KEY = 'tm-auth-redirect'

export class AuthRedirect {
  /**
   * @route client.lib.authRedirect.consume
   * @returns {string} The stored target (default `/`), which is then forgotten.
   */
  static consume(): string {
    const value = AuthRedirect.peek()
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      return value
    }
    return value
  }

  /**
   * @route client.lib.authRedirect.loginUrl
   * @param {string} current Path with search of the page the user was on.
   * @returns {string} `/login` carrying a sanitized `redirect` parameter.
   */
  static loginUrl(current: string): string {
    const target = AuthRedirect.sanitize(current)
    return target === '/' ? '/login' : `/login?redirect=${encodeURIComponent(target)}`
  }

  /**
   * @route client.lib.authRedirect.peek
   * @returns {string} The stored target, `/` when none.
   */
  static peek(): string {
    try {
      return AuthRedirect.sanitize(sessionStorage.getItem(STORAGE_KEY))
    } catch {
      return '/'
    }
  }

  /**
   * @route client.lib.authRedirect.sanitize
   * @param {unknown} path
   * @returns {string} A same-app absolute path, never an auth page, `/` otherwise.
   */
  static sanitize(path: unknown): string {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
      return '/'
    }
    if (AUTH_PATHS.some((prefix) => path.startsWith(prefix))) {
      return '/'
    }
    return path
  }

  /**
   * @route client.lib.authRedirect.store
   * @param {string} path
   * @returns {void}
   */
  static store(path: string): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, AuthRedirect.sanitize(path))
    } catch {
      return
    }
  }
}
