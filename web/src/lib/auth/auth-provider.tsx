import type { ReactNode } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { User } from '@/features/auth/api/auth'
import type { AuthContextValue, AuthStatus } from '@/lib/auth/auth-context'

import { fetchMe, loginRequest, logoutRequest } from '@/features/auth/api/auth'
import { AuthContext } from '@/lib/auth/auth-context'
import { onAuthFailure, refreshSession, setAccessToken } from '@/lib/auth/session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const query_client = useQueryClient()
  const [user, setUser] = useState<null | User>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    setStatus('unauthenticated')
    query_client.clear()
  }, [query_client])

  useEffect(() => {
    let active = true
    refreshSession()
      .then(fetchMe)
      .then((me) => {
        if (!active) return
        setUser(me)
        setStatus('authenticated')
      })
      .catch(() => {
        if (active) clearSession()
      })
    const unsubscribe = onAuthFailure(clearSession)
    return () => {
      active = false
      unsubscribe()
    }
  }, [clearSession])

  const login = useCallback(async (credentials: { email: string; password: string }) => {
    const token = await loginRequest(credentials)
    setAccessToken(token)
    const me = await fetchMe()
    setUser(me)
    setStatus('authenticated')
  }, [])

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
