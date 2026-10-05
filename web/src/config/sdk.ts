import { TimeManagerClient } from '@time-manager/sdk'

import { AuthRedirect } from '@/lib/auth-redirect'
import { useAuthStore } from '@/stores/auth'

export const sdk = new TimeManagerClient({
  baseUrl: import.meta.env.VITE_API_URL ?? '',
  getToken: () => useAuthStore.getState().accessToken,
  onLogout: () => {
    const had_session = useAuthStore.getState().accessToken !== null
    useAuthStore.getState().clear()
    if (had_session) {
      const { hash, pathname, search } = window.location
      window.location.assign(AuthRedirect.loginUrl(`${pathname}${search}${hash}`))
    }
  },
  onTokenRefresh: (token, session) => {
    const state = useAuthStore.getState()
    state.setSession({ accessToken: token, scopes: session.scopes, user: session.user })
  },
})
