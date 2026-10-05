import type { ReactNode } from 'react'

import { render } from '@testing-library/react'

import type { AuthContextValue } from '@/lib/auth/auth-context'

import { AuthContext } from '@/lib/auth/auth-context'

export function renderWithAuth(ui: ReactNode, value: Partial<AuthContextValue> = {}) {
  const context: AuthContextValue = {
    login: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    status: 'unauthenticated',
    user: null,
    ...value,
  }
  return render(<AuthContext value={context}>{ui}</AuthContext>)
}
