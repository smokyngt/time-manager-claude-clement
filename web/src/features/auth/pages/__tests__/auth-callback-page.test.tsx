import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AuthStatus } from '@/providers/use-auth'

import { AuthCallbackPage } from '@/features/auth/pages'
import { AuthRedirect } from '@/lib/auth-redirect'
import { TestAuth } from '@/test-support'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const sdk = vi.hoisted(() => ({ auth: {} }))

vi.mock('@/config/sdk', () => ({ sdk }))

function renderCallback(route: string, status: AuthStatus) {
  return TestAuth.render(
    <Routes>
      <Route element={<AuthCallbackPage />} path="/auth/callback" />
      <Route element={<p>reports page</p>} path="/reports" />
      <Route element={<p>home page</p>} path="/" />
    </Routes>,
    { auth: { status }, route },
  )
}

describe('AuthCallbackPage', () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it('redirects to the stored target once authenticated and forgets it', () => {
    AuthRedirect.store('/reports')
    renderCallback('/auth/callback', 'authenticated')
    expect(screen.getByText('reports page')).toBeInTheDocument()
    expect(AuthRedirect.peek()).toBe('/')
  })

  it('redirects home when nothing was stored', () => {
    renderCallback('/auth/callback', 'authenticated')
    expect(screen.getByText('home page')).toBeInTheDocument()
  })

  it('shows a status while the session loads', () => {
    renderCallback('/auth/callback', 'loading')
    expect(screen.getByRole('status')).toHaveTextContent('callback.completing')
  })

  it('shows the friendly unknown-user message with a link back', () => {
    renderCallback('/auth/callback?error=auth.microsoft.unknown.user', 'unauthenticated')
    expect(screen.getByRole('alert')).toHaveTextContent('errors:auth.microsoft.unknown.user')
    expect(screen.getByRole('heading', { name: 'callback.title' })).toHaveFocus()
    expect(screen.getByRole('link', { name: 'callback.back' })).toHaveAttribute('href', '/login')
  })

  it('maps unknown error codes to the generic Microsoft failure', () => {
    renderCallback('/auth/callback?error=weird', 'unauthenticated')
    expect(screen.getByRole('alert')).toHaveTextContent('errors:auth.microsoft.failed')
  })

  it('shows a failure when no session results without an error code', () => {
    renderCallback('/auth/callback', 'unauthenticated')
    expect(screen.getByRole('alert')).toHaveTextContent('errors:auth.microsoft.failed')
  })
})
