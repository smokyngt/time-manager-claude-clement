const STORAGE_KEY = 'tm_auth_from'

/** Only same-app absolute paths, never auth pages (avoids open redirects and loops). */
export function sanitizeFrom(path: unknown): string {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return '/'
  if (path.startsWith('/login') || path.startsWith('/auth/')) return '/'
  return path
}

export function saveFrom(path: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, sanitizeFrom(path))
  } catch {
    // storage unavailable
  }
}

export function peekFrom(): null | string {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY)
    return value ? sanitizeFrom(value) : null
  } catch {
    return null
  }
}

export function consumeFrom(): string {
  const value = peekFrom()
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage unavailable
  }
  return value ?? '/'
}
