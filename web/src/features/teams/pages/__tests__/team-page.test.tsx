import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotFoundError } from '@time-manager/sdk'
import { Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TeamFixtures } from '@/features/teams/__tests__/fixtures'
import { TeamPage } from '@/features/teams/pages/team-page'
import { TestAuth } from '@/test-support/test-auth'
import { TestQuery } from '@/test-support/test-query'
import { TestToast } from '@/test-support/test-toast'

const sdk = vi.hoisted(() => ({
  teamMembers: { add: vi.fn(), list: vi.fn(), remove: vi.fn() },
  teams: {
    archive: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
  },
  users: { list: vi.fn() },
}))

vi.mock('@/config/sdk', () => ({ sdk }))
vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const page = <T,>(items: T[]) => ({ items, more: false, next: null, total: items.length })
const member = TeamFixtures.user({ firstName: 'Ada', id: 'ada', lastName: 'Lovelace' })
const candidate = TeamFixtures.user({ firstName: 'Bob', id: 'bob', lastName: 'Stone' })

function renderPage(role: 'admin' | 'employee' | 'manager', options: { userId?: string } = {}) {
  const Toast = TestToast.wrapper()
  const id = options.userId ?? (role === 'manager' ? 'manager-1' : `${role}-1`)
  return TestAuth.render(
    <Toast>
      <Routes>
        <Route element={<TeamPage />} path="/teams/:teamId" />
        <Route element={<p>list</p>} path="/teams" />
      </Routes>
    </Toast>,
    { role, route: '/teams/team-1', user: { id } },
  )
}

describe('TeamPage', () => {
  beforeEach(() => {
    TestQuery.reset()
    vi.clearAllMocks()
    sdk.teams.retrieve.mockResolvedValue({ team: TeamFixtures.team() })
    sdk.teamMembers.list.mockResolvedValue(page([member]))
    sdk.users.list.mockResolvedValue(page([candidate]))
  })

  it('shows the team, its members and the title', async () => {
    renderPage('employee')
    expect(await screen.findByRole('heading', { level: 1, name: 'Support' })).toBeInTheDocument()
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(document.title).toContain('Support')
  })

  it('shows skeletons while loading', () => {
    sdk.teams.retrieve.mockReturnValue(new Promise(() => undefined))
    renderPage('admin')
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('explains a missing team without a retry', async () => {
    sdk.teams.retrieve.mockRejectedValue(new NotFoundError({ code: 'team.not.found', status: 404 }))
    renderPage('admin')
    expect(await screen.findByText('error.not_found_title')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'error.retry' })).not.toBeInTheDocument()
  })

  it('retries a failed load', async () => {
    sdk.teams.retrieve.mockRejectedValueOnce(new Error('down'))
    renderPage('admin')
    await userEvent.click(await screen.findByRole('button', { name: 'error.retry' }))
    expect(await screen.findByRole('heading', { name: 'Support' })).toBeInTheDocument()
  })

  it('gives employees no action', async () => {
    renderPage('employee')
    await screen.findByText('Ada Lovelace')
    expect(screen.queryByRole('button', { name: 'common:actions.edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'members.add.open' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'actions.dashboard' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'members.remove.label' })).not.toBeInTheDocument()
  })

  it('gives managers who do not own the team no action', async () => {
    renderPage('manager', { userId: 'someone-else' })
    await screen.findByText('Ada Lovelace')
    expect(screen.queryByRole('button', { name: 'common:actions.edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'actions.dashboard' })).not.toBeInTheDocument()
  })

  it('lets the owner edit, archive, add members and open the dashboard but not delete', async () => {
    renderPage('manager')
    await screen.findByText('Ada Lovelace')
    expect(screen.getByRole('button', { name: 'common:actions.edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common:actions.archive' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'members.add.open' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'actions.dashboard' })).toHaveAttribute(
      'href',
      '/teams/team-1/dashboard',
    )
    expect(screen.queryByRole('button', { name: 'common:actions.delete' })).not.toBeInTheDocument()
  })

  it('offers restore instead of edit on an archived team', async () => {
    sdk.teams.retrieve.mockResolvedValue({ team: TeamFixtures.team({ archivedAt: 5 }) })
    renderPage('admin')
    expect(
      await screen.findByRole('button', { name: 'common:actions.restore' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common:actions.edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'members.add.open' })).not.toBeInTheDocument()
  })

  it('archives the team', async () => {
    sdk.teams.archive.mockResolvedValue({ team: TeamFixtures.team() })
    renderPage('admin')
    await userEvent.click(await screen.findByRole('button', { name: 'common:actions.archive' }))
    await waitFor(() => {
      expect(sdk.teams.archive).toHaveBeenCalledWith('team-1')
    })
  })

  it('deletes the team after confirmation and returns to the list', async () => {
    sdk.teams.delete.mockResolvedValue({ deleted: ['team-1'], failed: [], success: true })
    renderPage('admin')
    await userEvent.click(await screen.findByRole('button', { name: 'common:actions.delete' }))
    const dialog = await screen.findByRole('dialog')
    expect(sdk.teams.delete).not.toHaveBeenCalled()
    await userEvent.click(
      dialog.querySelector('button[class*="bg-destructive"]') as HTMLButtonElement,
    )
    await waitFor(() => {
      expect(sdk.teams.delete).toHaveBeenCalledWith(['team-1'])
    })
    expect(await screen.findByText('list')).toBeInTheDocument()
  })

  it('adds members from the dialog', async () => {
    sdk.teamMembers.add.mockResolvedValue({ added: ['bob'], failed: [], success: true })
    renderPage('manager')
    await userEvent.click(await screen.findByRole('button', { name: 'members.add.open' }))
    await userEvent.click(await screen.findByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'members.add.submit' }))
    await waitFor(() => {
      expect(sdk.teamMembers.add).toHaveBeenCalledWith('team-1', ['bob'])
    })
  })

  it('suggests employees to managers', async () => {
    renderPage('manager')
    await userEvent.click(await screen.findByRole('button', { name: 'members.add.open' }))
    await screen.findByRole('checkbox')
    expect(sdk.users.list).toHaveBeenCalledWith(expect.objectContaining({ role: 'employee' }))
  })

  it('removes a member after confirmation', async () => {
    sdk.teamMembers.remove.mockResolvedValue({ failed: [], removed: ['ada'], success: true })
    renderPage('manager')
    await userEvent.click(await screen.findByRole('button', { name: 'members.remove.label' }))
    const dialog = await screen.findByRole('dialog')
    expect(sdk.teamMembers.remove).not.toHaveBeenCalled()
    await userEvent.click(
      dialog.querySelector('button[class*="bg-destructive"]') as HTMLButtonElement,
    )
    await waitFor(() => {
      expect(sdk.teamMembers.remove).toHaveBeenCalledWith('team-1', ['ada'])
    })
  })

  it('edits the team and sends the update', async () => {
    sdk.teams.update.mockResolvedValue({ failed: [], success: true, updated: ['team-1'] })
    renderPage('manager')
    await userEvent.click(await screen.findByRole('button', { name: 'common:actions.edit' }))
    const name = await screen.findByLabelText('form.name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Care')
    const submit = screen.getByRole('button', { name: 'edit.submit' })
    await waitFor(() => {
      expect(submit).toBeEnabled()
    })
    await userEvent.click(submit)
    await waitFor(() => {
      expect(sdk.teams.update).toHaveBeenCalledWith(
        ['team-1'],
        expect.objectContaining({ name: 'Care' }),
      )
    })
  })
})
