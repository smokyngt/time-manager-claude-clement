import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { AuthStatus } from '@/providers/use-auth'

import { AuthContext } from '@/providers/use-auth'
import { AuthGuard, GuestGuard, PermissionGuard } from '@/router/guards'
import { TestAuth } from '@/test-support/test-auth'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

function Where() {
  const { pathname, search } = useLocation()
  return <p>at:{`${pathname}${search}`}</p>
}

function renderRoutes(status: AuthStatus, entry: string, scopes: string[] = []) {
  const base = TestAuth.value()
  const value = {
    ...base,
    scopes: scopes as typeof base.scopes,
    status,
    user: status === 'authenticated' ? base.user : null,
  }
  const router = createMemoryRouter(
    [
      { element: <Where />, path: '/login' },
      { children: [{ element: <p>guest page</p>, path: '/guest' }], element: <GuestGuard /> },
      {
        children: [
          { element: <Where />, path: '/' },
          { element: <Where />, path: '/teams' },
          {
            children: [{ element: <p>secret</p>, path: '/admin' }],
            element: <PermissionGuard scope="teams:manage" />,
          },
          {
            children: [{ element: <p>both</p>, path: '/both' }],
            element: <PermissionGuard mode="all" scope={['teams:manage', 'users:manage']} />,
          },
        ],
        element: <AuthGuard />,
      },
    ],
    { initialEntries: [entry] },
  )
  return render(
    <AuthContext value={value}>
      <RouterProvider router={router} />
    </AuthContext>,
  )
}

describe('AuthGuard', () => {
  it('shows a spinner while the session boots', () => {
    renderRoutes('loading', '/')
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('redirects guests to /login with the current location', () => {
    renderRoutes('unauthenticated', '/teams?page=2')
    expect(screen.getByText('at:/login?redirect=%2Fteams%3Fpage%3D2')).toBeInTheDocument()
  })

  it('redirects the root without a redirect parameter', () => {
    renderRoutes('unauthenticated', '/')
    expect(screen.getByText('at:/login')).toBeInTheDocument()
  })

  it('renders protected routes when authenticated', () => {
    renderRoutes('authenticated', '/teams')
    expect(screen.getByText('at:/teams')).toBeInTheDocument()
  })
})

describe('GuestGuard', () => {
  it('lets guests through', () => {
    renderRoutes('unauthenticated', '/guest')
    expect(screen.getByText('guest page')).toBeInTheDocument()
  })

  it('sends signed-in users to the redirect target', () => {
    renderRoutes('authenticated', '/guest?redirect=%2Fteams')
    expect(screen.getByText('at:/teams')).toBeInTheDocument()
  })

  it('ignores unsafe redirect targets', () => {
    renderRoutes('authenticated', '/guest?redirect=https%3A%2F%2Fevil.com')
    expect(screen.getByText('at:/')).toBeInTheDocument()
  })
})

describe('PermissionGuard', () => {
  it('renders the route with the scope', () => {
    renderRoutes('authenticated', '/admin', ['teams:manage'])
    expect(screen.getByText('secret')).toBeInTheDocument()
  })

  it('renders AccessDenied without the scope', () => {
    renderRoutes('authenticated', '/admin', ['teams:read'])
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.getByText('access_denied.title')).toBeInTheDocument()
  })

  it('needs every scope in all mode', () => {
    renderRoutes('authenticated', '/both', ['teams:manage'])
    expect(screen.queryByText('both')).not.toBeInTheDocument()
  })

  it('accepts every scope in all mode', () => {
    renderRoutes('authenticated', '/both', ['teams:manage', 'users:manage'])
    expect(screen.getByText('both')).toBeInTheDocument()
  })
})
