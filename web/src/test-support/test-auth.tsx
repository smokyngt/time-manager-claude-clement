import type { Role, Scope, User } from '@time-manager/sdk'
import type { RenderResult } from '@testing-library/react'
import type { ReactNode } from 'react'

import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router'

import type { AuthContextValue } from '@/providers/use-auth'

import { queryClient } from '@/config/query'
import { AuthContext } from '@/providers/use-auth'

const ROLE_SCOPES: Record<Role, Scope[]> = {
  admin: [
    'auth:self',
    'clocks:manage',
    'clocks:read',
    'clocks:write',
    'reports:read',
    'teams:manage',
    'teams:read',
    'users:manage',
    'users:read',
    'users:write',
  ],
  employee: [
    'auth:self',
    'clocks:read',
    'clocks:write',
    'reports:read',
    'teams:read',
    'users:read',
    'users:write',
  ],
  manager: [
    'auth:self',
    'clocks:manage',
    'clocks:read',
    'clocks:write',
    'reports:read',
    'teams:manage',
    'teams:read',
    'users:manage',
    'users:read',
    'users:write',
  ],
}

export type RenderAuthOptions = {
  auth?: Partial<AuthContextValue>
  role?: Role
  route?: string
  scopes?: Scope[]
  user?: Partial<User>
}

export class TestAuth {
  /**
   * @route client.testSupport.testAuth.render
   * @param {ReactNode} ui
   * @param {RenderAuthOptions} options Scopes default to the role scopes, route to `/`.
   * @returns {RenderResult}
   */
  static render(ui: ReactNode, options: RenderAuthOptions = {}): RenderResult {
    const value = TestAuth.value(options)
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthContext value={value}>
          <MemoryRouter initialEntries={[options.route ?? '/']}>{ui}</MemoryRouter>
        </AuthContext>
      </QueryClientProvider>,
    )
  }

  /**
   * @route client.testSupport.testAuth.scopes
   * @param {Role} role
   * @returns {Scope[]}
   */
  static scopes(role: Role): Scope[] {
    return [...ROLE_SCOPES[role]]
  }

  /**
   * @route client.testSupport.testAuth.user
   * @param {Partial<User>} overrides
   * @returns {User}
   */
  static user(overrides: Partial<User> = {}): User {
    return {
      archivedAt: null,
      createdAt: 1_700_000_000_000,
      email: 'jane.doe@example.com',
      firstName: 'Jane',
      id: '0b3f4a9e-7d5c-4c1c-9a39-2f5f5a7a1e10',
      lastName: 'Doe',
      object: 'user',
      phoneNumber: null,
      role: 'employee',
      updatedAt: null,
      ...overrides,
    }
  }

  /**
   * @route client.testSupport.testAuth.value
   * @param {RenderAuthOptions} options
   * @returns {AuthContextValue}
   */
  static value(options: RenderAuthOptions = {}): AuthContextValue {
    const role = options.role ?? options.user?.role ?? 'employee'
    return {
      login: vi.fn(() => Promise.resolve()),
      loginWithMicrosoft: vi.fn(),
      logout: vi.fn(() => Promise.resolve()),
      scopes: options.scopes ?? TestAuth.scopes(role),
      status: 'authenticated',
      user: TestAuth.user({ role, ...options.user }),
      ...options.auth,
    }
  }
}
