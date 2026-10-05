import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { NewTeamDialog } from '@/features/teams/components/new-team-dialog'
import { makeUser, renderTeamUi } from '@/features/teams/test-utils'

const { createTeam } = vi.hoisted(() => ({ createTeam: vi.fn() }))

vi.mock('@/features/teams/api/teams', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/teams/api/teams')>()),
  createTeam,
}))
vi.mock('@/features/teams/api/users', () => ({
  listUserOptions: () => Promise.resolve([]),
  userName: () => '',
}))

vi.setConfig({ testTimeout: 30000 })

describe('NewTeamDialog', () => {
  it('shows validation errors and does not submit', async () => {
    renderTeamUi(<NewTeamDialog />, { user: makeUser('manager-1', 'manager') })

    await userEvent.click(screen.getByRole('button', { name: 'New team' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create team' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(createTeam).not.toHaveBeenCalled()
  })

  it('rejects an end time that is not after the start time', async () => {
    renderTeamUi(<NewTeamDialog />, { user: makeUser('manager-1', 'manager') })

    await userEvent.click(screen.getByRole('button', { name: 'New team' }))
    await userEvent.type(screen.getByLabelText('Name'), 'Ops')
    await userEvent.clear(screen.getByLabelText('Work end'))
    await userEvent.type(screen.getByLabelText('Work end'), '08:00')
    await userEvent.click(screen.getByRole('button', { name: 'Create team' }))

    expect(await screen.findByText('End must be after start')).toBeInTheDocument()
    expect(createTeam).not.toHaveBeenCalled()
  })

  it('submits a valid team with the manager forced to the current manager', async () => {
    createTeam.mockResolvedValue({ name: 'Ops' })
    renderTeamUi(<NewTeamDialog />, { user: makeUser('manager-1', 'manager') })

    await userEvent.click(screen.getByRole('button', { name: 'New team' }))
    await userEvent.type(screen.getByLabelText('Name'), 'Ops')
    await userEvent.click(screen.getByRole('button', { name: 'Create team' }))

    await vi.waitFor(() => {
      expect(createTeam).toHaveBeenCalledWith({
        manager_id: 'manager-1',
        name: 'Ops',
        weekly_hours_target: 35,
        work_end: '17:00',
        work_start: '09:00',
      })
    })
  })

  it('renders nothing for employees', () => {
    renderTeamUi(<NewTeamDialog />, { user: makeUser('e1', 'employee') })
    expect(screen.queryByRole('button', { name: 'New team' })).not.toBeInTheDocument()
  })
})
