import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Role } from '@/features/users/types'

import { UsersBulkToolbar } from '@/features/users/components/users-bulk-toolbar'

function setup(props: Partial<{ actorRole: Role; archived: boolean; count: number }> = {}) {
  const handlers = {
    onArchive: vi.fn(),
    onClear: vi.fn(),
    onDelete: vi.fn(),
    onRestore: vi.fn(),
  }
  render(
    <UsersBulkToolbar
      actorRole="admin"
      archived={false}
      count={2}
      pending={false}
      {...props}
      {...handlers}
    />,
  )
  return handlers
}

describe('UsersBulkToolbar', () => {
  it('renders nothing when no user is selected', () => {
    setup({ count: 0 })
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
  })

  it('shows the selection count and archives', async () => {
    const handlers = setup()
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(handlers.onArchive).toHaveBeenCalledOnce()
  })

  it('offers restore instead of archive for archived users', async () => {
    const handlers = setup({ archived: true })
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(handlers.onRestore).toHaveBeenCalledOnce()
  })

  it('hides delete for managers', () => {
    setup({ actorRole: 'manager' })
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('requires confirmation before deleting', async () => {
    const handlers = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(handlers.onDelete).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Delete 2 users?')
    await userEvent.click(screen.getByRole('button', { name: 'Delete', description: '' }))
    expect(handlers.onDelete).toHaveBeenCalledOnce()
  })

  it('clears the selection', async () => {
    const handlers = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(handlers.onClear).toHaveBeenCalledOnce()
  })
})
