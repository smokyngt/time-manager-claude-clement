import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TeamActions } from '@/features/teams/components/team-actions'
import { makeUser, renderTeamUi, TEAM } from '@/features/teams/test-utils'

vi.mock('@/features/teams/api/teams', () => ({}))
vi.mock('@/features/teams/api/users', () => ({
  listUserOptions: () => Promise.resolve([]),
  userName: () => '',
}))

describe('TeamActions', () => {
  it('lets an admin edit, archive and delete', () => {
    renderTeamUi(<TeamActions team={TEAM} />, { user: makeUser('a1', 'admin') })
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('lets the managing manager edit and archive but not delete', () => {
    renderTeamUi(<TeamActions team={TEAM} />, { user: makeUser('manager-1', 'manager') })
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('hides all actions from another manager and from employees', () => {
    const { unmount } = renderTeamUi(<TeamActions team={TEAM} />, {
      user: makeUser('manager-2', 'manager'),
    })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    unmount()
    renderTeamUi(<TeamActions team={TEAM} />, { user: makeUser('e1', 'employee') })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('offers restore instead of edit and archive for an archived team', () => {
    renderTeamUi(<TeamActions team={{ ...TEAM, archived_at: 1 }} />, {
      user: makeUser('a1', 'admin'),
    })
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
  })
})
