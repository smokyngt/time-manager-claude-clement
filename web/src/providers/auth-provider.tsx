import type { ReactNode } from 'react'

import { useCallback, useEffect, useMemo, useState } from 'react'

import type { AuthContextValue, AuthStatus } from '@/providers/use-auth'

import { queryClient } from '@/config/query'
import { sdk } from '@/config/sdk'
import { AuthRedirect } from '@/lib/auth-redirect'
import { AuthContext } from '@/providers/use-auth'
import { useAuthStore } from '@/stores/auth'
import { useUndoStore } from '@/stores/undo'

export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const scopes = useAuthStore((state) => state.scopes)
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    let active = true
    const boot = async () => {
      try {
        const session = await sdk.auth.refresh()
        useAuthStore
          .getState()
          .setSession({
            accessToken: session.accessToken,
            scopes: session.scopes,
            user: session.user,
          })
        const me = await sdk.auth.me()
        useAuthStore.getState().setUser(me.user)
      } catch {
        useAuthStore.getState().clear()
      } finally {
        if (active) {
          setBooted(true)
        }
      }
    }
    void boot()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (booted && user === null) {
      queryClient.clear()
      useUndoStore.getState().clear()
    }
  }, [booted, user])

  const login = useCallback(async (credentials: { email: string; password: string }) => {
    const session = await sdk.auth.login(credentials)
    useAuthStore
      .getState()
      .setSession({ accessToken: session.accessToken, scopes: session.scopes, user: session.user })
  }, [])

  const logout = useCallback(async () => {
    try {
      await sdk.auth.logout()
    } finally {
      useAuthStore.getState().clear()
    }
  }, [])

  const loginWithMicrosoft = useCallback((redirect?: string) => {
    if (redirect !== undefined) {
      AuthRedirect.store(redirect)
    }
    window.location.assign(sdk.auth.microsoftUrl())
  }, [])

  const status: AuthStatus = !booted ? 'loading' : user ? 'authenticated' : 'unauthenticated'

  const value = useMemo<AuthContextValue>(
    () => ({ login, loginWithMicrosoft, logout, scopes, status, user }),
    [login, loginWithMicrosoft, logout, scopes, status, user],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
