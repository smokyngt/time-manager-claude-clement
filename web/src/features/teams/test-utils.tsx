import type { ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'

import type { Team } from '@/features/teams/api/types'
import type { AuthContextValue } from '@/lib/auth/auth-context'

import { renderWithAuth } from '@/test/render'

export const TEAM: Team = {
  archived_at: null,
  created_at: 0,
  description: 'Platform crew',
  id: 'team-1',
  manager_id: 'manager-1',
  member_count: 2,
  name: 'Platform',
  object: 'team',
  updated_at: 0,
  weekly_hours_target: 35,
  work_end: '17:00',
  work_start: '09:00',
}

export function makeUser(id: string, role: 'admin' | 'employee' | 'manager') {
  return {
    email: `${id}@example.com`,
    first_name: id,
    id,
    last_name: 'User',
    phone_number: null,
    role,
  }
}

export function renderTeamUi(ui: ReactNode, auth: Partial<AuthContextValue> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderWithAuth(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
    { status: 'authenticated', ...auth },
  )
}
