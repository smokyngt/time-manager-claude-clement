import type { Scope, User } from '@time-manager/sdk'

import { createContext, use } from 'react'

export type AuthStatus = 'authenticated' | 'loading' | 'unauthenticated'

export type AuthContextValue = {
  login: (credentials: { email: string; password: string }) => Promise<void>
  loginWithMicrosoft: (redirect?: string) => void
  logout: () => Promise<void>
  scopes: Scope[]
  status: AuthStatus
  user: null | User
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = use(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
