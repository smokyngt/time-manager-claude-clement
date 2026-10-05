import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { TeamFixtures } from '@/features/teams/__tests__/fixtures'
import { TeamList } from '@/features/teams/components/team-list'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const teams = [
  TeamFixtures.team({ id: 'a', name: 'Alpha' }),
  TeamFixtures.team({ id: 'b', name: 'Beta' }),
  TeamFixtures.team({ archivedAt: 1, id: 'c', name: 'Gamma' }),
]

function renderList(props: Partial<React.ComponentProps<typeof TeamList>> = {}) {
  return render(
    <MemoryRouter>
      <TeamList teams={teams} {...props} />
    </MemoryRouter>,
  )
}

describe('TeamList', () => {
  it('renders skeletons while loading', () => {
    renderList({ loading: true, skeletonCount: 4, teams: [] })
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status.querySelectorAll('.animate-pulse')).toHaveLength(4)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('renders the empty state with its action', () => {
    renderList({ emptyAction: <button type="button">create</button>, teams: [] })
    expect(screen.getByText('empty.title')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'create' })).toBeInTheDocument()
  })

  it('renders a card per team linking to the team page', () => {
    renderList()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '/teams/a')
    expect(screen.getByText('card.archived')).toBeInTheDocument()
  })

  it('hides the actions and checkboxes without callbacks', () => {
    renderList()
    expect(screen.queryByRole('button', { name: /card.actions/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('shows only the actions whose callbacks exist', async () => {
    renderList({ onArchive: vi.fn(), onEdit: vi.fn(), onRestore: vi.fn() })
    await userEvent.click(screen.getByRole('button', { name: 'card.actions' }))
    expect(await screen.findByRole('menuitem', { name: 'common:actions.edit' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'common:actions.archive' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'common:actions.delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'common:actions.restore' })).toBeNull()
  })

  it('offers restore on archived teams only', async () => {
    renderList({ onArchive: vi.fn(), onRestore: vi.fn() })
    const buttons = screen.getAllByRole('button', { name: 'card.actions' })
    expect(buttons).toHaveLength(3)
    await userEvent.click(buttons[2]!)
    expect(await screen.findByRole('menuitem', { name: 'common:actions.restore' })).toBeVisible()
    expect(screen.queryByRole('menuitem', { name: 'common:actions.archive' })).toBeNull()
  })

  it('calls the callback with the team', async () => {
    const onDelete = vi.fn()
    renderList({ onDelete })
    await userEvent.click(screen.getAllByRole('button', { name: 'card.actions' })[0]!)
    await userEvent.click(await screen.findByRole('menuitem', { name: 'common:actions.delete' }))
    expect(onDelete).toHaveBeenCalledWith(teams[0])
  })

  it('hides actions of teams the user cannot manage', () => {
    renderList({
      isManageable: (team) => team.id === 'a',
      onEdit: vi.fn(),
      onToggle: vi.fn(),
    })
    expect(screen.getAllByRole('button', { name: 'card.actions' })).toHaveLength(1)
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
  })

  it('toggles the selection', async () => {
    const onToggle = vi.fn()
    renderList({ onToggle, selectedIds: new Set(['b']) })
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes[1]).toBeChecked()
    await userEvent.click(boxes[0]!)
    expect(onToggle).toHaveBeenCalledWith('a')
  })

  it('moves focus with the arrow keys (roving tabindex)', async () => {
    renderList({ viewMode: 'list' })
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveAttribute('tabindex', '0')
    expect(items[1]).toHaveAttribute('tabindex', '-1')
    items[0]?.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(items[1]).toHaveFocus()
    expect(within(items[1]!).getByRole('link', { name: 'Beta' })).toBeInTheDocument()
  })

  it('shows the manager name', () => {
    renderList({ managerNames: { 'manager-1': 'Jane Doe' } })
    expect(screen.getAllByText('card.manager')).toHaveLength(3)
  })
})
