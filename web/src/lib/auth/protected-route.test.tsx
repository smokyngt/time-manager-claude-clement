import { screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import type { User } from '@/features/auth/api/auth'

import { ProtectedRoute } from '@/lib/auth/protected-route'
import { RoleRoute } from '@/lib/auth/role-route'
import { renderWithAuth } from '@/test/render'

const employee: User = {
  email: 'e@x.co',
  first_name: 'Eve',
  id: '1',
  last_name: 'Doe',
  phone_number: null,
  role: 'employee',
}

function renderRoutes(auth: Parameters<typeof renderWithAuth>[1], entry: string) {
  const router = createMemoryRouter(
    [
      { element: <p>Login page</p>, path: '/login' },
      {
        children: [
          { element: <p>Home</p>, path: '/' },
          {
            children: [{ element: <p>Users</p>, path: '/users' }],
            element: <RoleRoute roles={['manager', 'admin']} />,
          },
        ],
        element: <ProtectedRoute />,
      },
    ],
    { initialEntries: [entry] },
  )
  return renderWithAuth(<RouterProvider router={router} />, auth)
}

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to /login', () => {
    renderRoutes({ status: 'unauthenticated' }, '/')
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('shows a spinner while loading', () => {
    renderRoutes({ status: 'loading' }, '/')
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    renderRoutes({ status: 'authenticated', user: employee }, '/')
    expect(screen.getByText('Home')).toBeInTheDocument()
  })
})

describe('RoleRoute', () => {
  it('redirects employees away from manager pages', () => {
    renderRoutes({ status: 'authenticated', user: employee }, '/users')
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('allows managers', () => {
    renderRoutes({ status: 'authenticated', user: { ...employee, role: 'manager' } }, '/users')
    expect(screen.getByText('Users')).toBeInTheDocument()
  })
})
