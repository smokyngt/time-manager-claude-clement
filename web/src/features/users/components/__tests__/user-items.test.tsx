import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { UserCard } from '@/features/users/components/user-card'
import { UserRow } from '@/features/users/components/user-row'
import { UsersBulkToolbar } from '@/features/users/components/users-bulk-toolbar'
import { UsersSkeleton } from '@/features/users/components/users-skeleton'
import { TestAuth } from '@/test-support'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const admin = { id: 'a', role: 'admin' } as const
const manager = { id: 'm', role: 'manager' } as const
const employee = TestAuth.user({ id: 'e', role: 'employee' })
const otherManager = TestAuth.user({ id: 'o', role: 'manager' })

async function openMenu(name: string) {
  await userEvent.click(screen.getByRole('button', { name }))
}

describe.each([
  ['UserCard', UserCard],
  ['UserRow', UserRow],
])('%s', (_name, Item) => {
  it('renders no actions without callbacks', () => {
    render(<Item actor={admin} index={0} user={employee} />)
    expect(screen.queryByRole('button', { name: /actions_for/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('shows every action for an admin and fires callbacks', async () => {
    const handlers = {
      onArchive: vi.fn(),
      onDelete: vi.fn(),
      onEdit: vi.fn(),
      onView: vi.fn(),
      onViewReport: vi.fn(),
    }
    render(<Item actor={admin} index={0} user={employee} {...handlers} />)
    await openMenu('list.actions_for')
    expect(screen.getByRole('menuitem', { name: 'actions.edit' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'actions.archive' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'actions.open_report' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: 'actions.delete' }))
    expect(handlers.onDelete).toHaveBeenCalledWith(employee)
  })

  it('hides delete for managers and all actions on managers they cannot manage', async () => {
    const onDelete = vi.fn()
    const onEdit = vi.fn()
    const { rerender } = render(
      <Item actor={manager} index={0} onDelete={onDelete} onEdit={onEdit} user={employee} />,
    )
    await openMenu('list.actions_for')
    expect(screen.queryByRole('menuitem', { name: 'actions.delete' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'actions.edit' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    rerender(
      <Item actor={manager} index={0} onDelete={onDelete} onEdit={onEdit} user={otherManager} />,
    )
    expect(screen.queryByRole('button', { name: 'list.actions_for' })).not.toBeInTheDocument()
  })

  it('offers restore instead of archive for archived users and no checkbox for self', async () => {
    const archived = TestAuth.user({ archivedAt: 1, id: 'z' })
    render(
      <Item
        actor={admin}
        index={0}
        onArchive={vi.fn()}
        onRestore={vi.fn()}
        onSelect={vi.fn()}
        user={archived}
      />,
    )
    await openMenu('list.actions_for')
    expect(screen.getByRole('menuitem', { name: 'actions.restore' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'actions.archive' })).not.toBeInTheDocument()
  })

  it('toggles selection only when selectable', async () => {
    const onSelect = vi.fn()
    const { rerender } = render(
      <Item actor={admin} index={0} onSelect={onSelect} user={employee} />,
    )
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onSelect).toHaveBeenCalledWith(employee.id)
    rerender(
      <Item actor={admin} index={0} onSelect={onSelect} user={{ ...employee, id: admin.id }} />,
    )
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})

describe('UsersBulkToolbar', () => {
  it('renders nothing without selection', () => {
    const { container } = render(<UsersBulkToolbar count={0} onClear={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('only requests actions and hides ones without callbacks', async () => {
    const onArchive = vi.fn()
    render(<UsersBulkToolbar count={2} onArchive={onArchive} onClear={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'bulk.delete' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'bulk.archive' }))
    expect(onArchive).toHaveBeenCalledTimes(1)
  })
})

describe('UsersSkeleton', () => {
  it('is an accessible busy status', () => {
    render(<UsersSkeleton />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })
})
