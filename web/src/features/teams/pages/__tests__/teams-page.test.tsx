import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TeamFixtures } from '@/features/teams/__tests__/fixtures'
import { TeamsPage } from '@/features/teams/pages/teams-page'
import { TestAuth } from '@/test-support/test-auth'
import { TestKeyboard } from '@/test-support/test-keyboard'
import { TestQuery } from '@/test-support/test-query'
import { TestToast } from '@/test-support/test-toast'

const sdk = vi.hoisted(() => ({
  teamMembers: { add: vi.fn(), list: vi.fn(), remove: vi.fn() },
  teams: {
    archive: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    restore: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
  },
  users: { list: vi.fn() },
}))

vi.mock('@/config/sdk', () => ({ sdk }))
vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const page = <T,>(items: T[]) => ({ items, more: false, next: null, total: items.length })
const mine = TeamFixtures.team({ id: 'mine', managerId: 'manager-1', name: 'Mine' })
const theirs = TeamFixtures.team({ id: 'theirs', managerId: 'other', name: 'Theirs' })

function renderPage(role: 'admin' | 'employee' | 'manager', route = '/teams') {
  const Toast = TestToast.wrapper()
  return TestAuth.render(
    <Toast>
      <TeamsPage />
    </Toast>,
    { role, route, user: { id: role === 'manager' ? 'manager-1' : `${role}-1` } },
  )
}

async function openMenu(name: string) {
  const card = TeamFixtures.closest(screen.getByRole('link', { name }), 'li')
  const trigger = TeamFixtures.closest(card, 'li').querySelector(
    'button[aria-label="card.actions"]',
  ) as HTMLElement
  await userEvent.click(trigger)
}

describe('TeamsPage', () => {
  beforeEach(() => {
    TestQuery.reset()
    vi.clearAllMocks()
    sdk.teams.list.mockResolvedValue(page([mine, theirs]))
    sdk.users.list.mockResolvedValue(page([]))
  })

  it('lists the teams and sets the document title', async () => {
    renderPage('admin')
    expect(await screen.findByRole('link', { name: 'Mine' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Theirs' })).toBeInTheDocument()
    expect(document.title).toContain('title')
  })

  it('shows skeletons first, then the error with a retry', async () => {
    sdk.teams.list.mockRejectedValue(new Error('down'))
    renderPage('admin')
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    sdk.teams.list.mockResolvedValue(page([mine]))
    await userEvent.click(screen.getByRole('button', { name: 'error.retry' }))
    expect(await screen.findByRole('link', { name: 'Mine' })).toBeInTheDocument()
  })

  it('shows the empty state with a create action for managers', async () => {
    sdk.teams.list.mockResolvedValue(page([]))
    renderPage('manager')
    expect(await screen.findByText('empty.title')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'actions.new' })).toHaveLength(2)
  })

  it('lets employees only look', async () => {
    renderPage('employee')
    await screen.findByRole('link', { name: 'Mine' })
    expect(screen.queryByRole('button', { name: 'actions.new' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    await openMenu('Mine')
    expect(await screen.findByRole('menuitem', { name: 'actions.quick_view' })).toBeVisible()
    expect(screen.queryByRole('menuitem', { name: 'common:actions.edit' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'common:actions.delete' })).toBeNull()
  })

  it('lets managers edit and archive only the teams they own', async () => {
    renderPage('manager')
    await screen.findByRole('link', { name: 'Mine' })
    expect(screen.getByRole('button', { name: 'actions.new' })).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    await openMenu('Mine')
    expect(await screen.findByRole('menuitem', { name: 'common:actions.edit' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'common:actions.archive' })).toBeVisible()
    expect(screen.queryByRole('menuitem', { name: 'common:actions.delete' })).toBeNull()
  })

  it('lets admins manage and delete every team', async () => {
    renderPage('admin')
    await screen.findByRole('link', { name: 'Theirs' })
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    await openMenu('Theirs')
    expect(await screen.findByRole('menuitem', { name: 'common:actions.delete' })).toBeVisible()
  })

  it('archives from the menu', async () => {
    sdk.teams.archive.mockResolvedValue({ team: mine })
    renderPage('manager')
    await screen.findByRole('link', { name: 'Mine' })
    await openMenu('Mine')
    await userEvent.click(await screen.findByRole('menuitem', { name: 'common:actions.archive' }))
    await waitFor(() => {
      expect(sdk.teams.archive).toHaveBeenCalledWith('mine')
    })
  })

  it('filters by name client-side after the debounce', async () => {
    renderPage('admin')
    await screen.findByRole('link', { name: 'Mine' })
    await userEvent.type(screen.getByRole('searchbox'), 'thei')
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Mine' })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: 'Theirs' })).toBeInTheDocument()
    expect(sdk.teams.list).toHaveBeenCalledTimes(1)
  })

  it('reads the archived filter and order from the URL', async () => {
    renderPage('admin', '/teams?archived=true&order=asc')
    await screen.findByText('Mine')
    expect(sdk.teams.list).toHaveBeenCalledWith(
      expect.objectContaining({ archived: true, order: 'asc' }),
    )
  })

  it('selects with the keyboard and shows the bulk bar', async () => {
    renderPage('admin')
    await screen.findByRole('link', { name: 'Mine' })
    TestKeyboard.press('a', { ctrl: true })
    expect(await screen.findByRole('region', { name: 'bulk.label' })).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(2)
    TestKeyboard.press('Escape')
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'bulk.label' })).not.toBeInTheDocument()
    })
  })

  it('bulk archives the selection', async () => {
    sdk.teams.archive.mockResolvedValue({ team: mine })
    renderPage('admin')
    await screen.findByRole('link', { name: 'Mine' })
    await userEvent.click(TeamFixtures.at(screen.getAllByRole('checkbox'), 0))
    await userEvent.click(screen.getByRole('button', { name: 'common:actions.archive' }))
    await waitFor(() => {
      expect(sdk.teams.archive).toHaveBeenCalledWith('mine')
    })
  })

  it('offers bulk delete to admins only', async () => {
    const { unmount } = renderPage('admin')
    await screen.findByRole('link', { name: 'Mine' })
    await userEvent.click(TeamFixtures.at(screen.getAllByRole('checkbox'), 0))
    expect(screen.getByRole('button', { name: 'common:actions.delete' })).toBeInTheDocument()
    unmount()
    TestQuery.reset()
    renderPage('manager')
    await screen.findByRole('link', { name: 'Mine' })
    await userEvent.click(TeamFixtures.at(screen.getAllByRole('checkbox'), 0))
    expect(screen.queryByRole('button', { name: 'common:actions.delete' })).not.toBeInTheDocument()
  })

  it('opens the create dialog and creates a team', async () => {
    sdk.teams.create.mockResolvedValue({ team: mine })
    renderPage('manager')
    await screen.findByRole('link', { name: 'Mine' })
    await userEvent.click(screen.getByRole('button', { name: 'actions.new' }))
    await userEvent.type(await screen.findByLabelText('form.name'), 'Ops')
    const submit = screen.getByRole('button', { name: 'create.submit' })
    await waitFor(() => {
      expect(submit).toBeEnabled()
    })
    await userEvent.click(submit)
    await waitFor(() => {
      expect(sdk.teams.create).toHaveBeenCalledWith({
        name: 'Ops',
        weeklyHoursTarget: 35,
        workEnd: '17:00',
        workStart: '09:00',
      })
    })
  })

  it('confirms before deleting', async () => {
    renderPage('admin')
    await screen.findByRole('link', { name: 'Mine' })
    await openMenu('Mine')
    await userEvent.click(await screen.findByRole('menuitem', { name: 'common:actions.delete' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(sdk.teams.delete).not.toHaveBeenCalled()
  })
})
