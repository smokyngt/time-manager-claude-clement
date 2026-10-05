import type { ReactNode } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { User } from '@/features/auth/api/auth'
import type { AuthContextValue, AuthStatus } from '@/lib/auth/auth-context'

import { fetchMe, loginRequest, logoutRequest } from '@/features/auth/api/auth'
import { AuthContext } from '@/lib/auth/auth-context'
import {
  applySession,
  clearRefreshTimer,
  onAuthFailure,
  onSessionRefreshed,
  refreshSession,
  setAccessToken,
} from '@/lib/auth/session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const query_client = useQueryClient()
  const [user, setUser] = useState<null | User>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const status_ref = useRef<AuthStatus>('loading')

  const updateStatus = useCallback((next: AuthStatus) => {
    status_ref.current = next
    setStatus(next)
  }, [])

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    updateStatus('unauthenticated')
    query_client.clear()
  }, [query_client, updateStatus])

  useEffect(() => {
    let active = true
    // Boot: refresh via cookie, then /me. (Refresh also seeds the user through onSessionRefreshed.)
    refreshSession()
      .then(fetchMe)
      .then((me) => {
        if (!active) return
        setUser(me)
        updateStatus('authenticated')
      })
      .catch(() => {
        if (active) clearSession()
      })
    const unsubscribe_failure = onAuthFailure(() => {
      if (!active) return
      // Refresh failed mid-session: ProtectedRoute redirects to /login preserving `from`.
      if (status_ref.current === 'authenticated') toast.error('Your session expired')
      clearSession()
    })
    const unsubscribe_refresh = onSessionRefreshed((session) => {
      // Only seed once authenticated; boot waits for /me.
      if (active && status_ref.current === 'authenticated') setUser(session.user)
    })
    return () => {
      active = false
      unsubscribe_failure()
      unsubscribe_refresh()
      clearRefreshTimer()
    }
  }, [clearSession, updateStatus])

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      const session = await loginRequest(credentials)
      applySession(session)
      setUser(session.user)
      updateStatus('authenticated')
    },
    [updateStatus],
  )

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } finally {
      clearSession()
    }
  }, [clearSession])

  const value = useMemo<AuthContextValue>(
    () => ({ login, logout, status, user }),
    [login, logout, status, user],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
