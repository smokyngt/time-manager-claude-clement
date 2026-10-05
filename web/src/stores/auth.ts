import type { Scope, User } from '@time-manager/sdk'

import { create } from 'zustand'

export type AuthSessionState = {
  accessToken: string
  scopes: Scope[]
  user: User
}

export type AuthState = {
  accessToken: null | string
  clear: () => void
  scopes: Scope[]
  setSession: (session: AuthSessionState) => void
  setToken: (token: string) => void
  setUser: (user: User) => void
  user: null | User
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  clear: () => {
    set({ accessToken: null, scopes: [], user: null })
  },
  scopes: [],
  setSession: (session) => {
    set({ accessToken: session.accessToken, scopes: session.scopes, user: session.user })
  },
  setToken: (token) => {
    set({ accessToken: token })
  },
  setUser: (user) => {
    set({ user })
  },
  user: null,
}))
