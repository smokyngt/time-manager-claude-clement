import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AddMembersDialog } from '@/features/teams/components/add-members-dialog'
import { makeUser, renderTeamUi } from '@/features/teams/test-utils'

const { addTeamMembers, listUserOptions } = vi.hoisted(() => ({
  addTeamMembers: vi.fn(),
  listUserOptions: vi.fn(),
}))

vi.mock('@/features/teams/api/teams', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/teams/api/teams')>()),
  addTeamMembers,
  listTeamMembers: () => Promise.resolve([makeUser('already', 'employee')]),
}))
vi.mock('@/features/teams/api/users', () => ({
  listUserOptions,
  userName: (user: { first_name: string; last_name: string }) =>
    `${user.first_name} ${user.last_name}`,
}))

vi.setConfig({ testTimeout: 30000 })

describe('AddMembersDialog', () => {
  it('selects several users, hides existing members and submits their ids', async () => {
    listUserOptions.mockResolvedValue([
      makeUser('alice', 'employee'),
      makeUser('already', 'employee'),
      makeUser('bob', 'employee'),
    ])
    addTeamMembers.mockResolvedValue({ failed: 0, ok: 2 })
    renderTeamUi(<AddMembersDialog team_id="team-1" />, { user: makeUser('m1', 'manager') })

    await userEvent.click(screen.getByRole('button', { name: 'Add members' }))
    expect(listUserOptions).toHaveBeenCalledWith(['employee'])

    await userEvent.click(await screen.findByRole('checkbox', { name: /alice User/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /bob User/ }))
    expect(screen.queryByRole('checkbox', { name: /already User/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Add 2 selected' }))
    await vi.waitFor(() => {
      expect(addTeamMembers).toHaveBeenCalledWith('team-1', ['alice', 'bob'])
    })
  })

  it('filters users with the search box and keeps submit disabled with no selection', async () => {
    listUserOptions.mockResolvedValue([makeUser('alice', 'employee'), makeUser('bob', 'employee')])
    renderTeamUi(<AddMembersDialog team_id="team-1" />, { user: makeUser('a1', 'admin') })

    await userEvent.click(screen.getByRole('button', { name: 'Add members' }))
    expect(listUserOptions).toHaveBeenCalledWith(['admin', 'employee', 'manager'])
    await userEvent.type(await screen.findByLabelText('Search'), 'bob')

    expect(screen.queryByRole('checkbox', { name: /alice User/ })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /bob User/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add selected' })).toBeDisabled()
  })
})
