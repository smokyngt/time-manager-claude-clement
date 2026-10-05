export interface AuthFetchDeps {
  base_fetch?: (request: Request) => Promise<Response>
  get_token: () => null | string
  on_auth_failure: () => void
  refresh: () => Promise<string>
  skip_paths?: string[]
}

const DEFAULT_SKIP_PATHS = ['/v1/auth/login', '/v1/auth/refresh', '/v1/auth/logout']

export function createAuthFetch(deps: AuthFetchDeps) {
  const base_fetch = deps.base_fetch ?? ((request: Request) => fetch(request))
  const skip_paths = deps.skip_paths ?? DEFAULT_SKIP_PATHS

  function withToken(request: Request, token: null | string) {
    if (!token) return request
    const headers = new Headers(request.headers)
    headers.set('Authorization', `Bearer ${token}`)
    return new Request(request, { headers })
  }

  return async function authFetch(request: Request) {
    const { pathname } = new URL(request.url, window.location.origin)
    if (skip_paths.some((path) => pathname.endsWith(path))) return base_fetch(request)

    const retry_request = request.clone()
    const response = await base_fetch(withToken(request, deps.get_token()))
    if (response.status !== 401) return response

    try {
      const token = await deps.refresh()
      return await base_fetch(withToken(retry_request, token))
    } catch {
      deps.on_auth_failure()
      return response
    }
  }
}
