import { screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getCallbackErrorMessage } from '@/features/auth/auth-errors'
import { AuthCallbackPage } from '@/features/auth/pages/auth-callback-page'
import { saveFrom } from '@/lib/auth/redirect'
import { renderWithAuth } from '@/test/render'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

function renderCallback(entry: string, status: 'authenticated' | 'loading' | 'unauthenticated') {
  const router = createMemoryRouter(
    [
      { element: <AuthCallbackPage />, path: '/auth/callback' },
      { element: <p>Login page</p>, path: '/login' },
      { element: <p>Reports page</p>, path: '/reports' },
      { element: <p>Home</p>, path: '/' },
    ],
    { initialEntries: [entry] },
  )
  return renderWithAuth(<RouterProvider router={router} />, { status })
}

describe('callback error mapping', () => {
  it('maps unknown user to a friendly message', () => {
    expect(getCallbackErrorMessage('AUTH_MICROSOFT_UNKNOWN_USER')).toBe(
      'Your Microsoft account is not registered. Ask your manager to create your account.',
    )
  })

  it('falls back for unknown codes', () => {
    expect(getCallbackErrorMessage('WHATEVER')).toMatch(/Microsoft sign-in failed/)
  })
})

describe('AuthCallbackPage', () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it('shows the error with a link back to /login', () => {
    renderCallback('/auth/callback?error=AUTH_MICROSOFT_UNKNOWN_USER', 'unauthenticated')
    expect(screen.getByRole('alert')).toHaveTextContent('not registered')
    expect(screen.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', '/login')
  })

  it('redirects to the stored `from` page once authenticated', () => {
    saveFrom('/reports')
    renderCallback('/auth/callback', 'authenticated')
    expect(screen.getByText('Reports page')).toBeInTheDocument()
    expect(sessionStorage.getItem('tm_auth_from')).toBeNull()
  })

  it('redirects home when nothing was stored', () => {
    renderCallback('/auth/callback', 'authenticated')
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('ignores unsafe stored paths', () => {
    sessionStorage.setItem('tm_auth_from', '//evil.com')
    renderCallback('/auth/callback', 'authenticated')
    expect(screen.getByText('Home')).toBeInTheDocument()
  })
})
