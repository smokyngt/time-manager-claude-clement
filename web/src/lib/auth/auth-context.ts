import { createContext } from 'react'

import type { User } from '@/features/auth/api/auth'

export interface AuthContextValue {
  login: (credentials: { email: string; password: string }) => Promise<void>
  logout: () => Promise<void>
  status: AuthStatus
  user: null | User
}

export type AuthStatus = 'authenticated' | 'loading' | 'unauthenticated'

export const AuthContext = createContext<AuthContextValue | null>(null)
