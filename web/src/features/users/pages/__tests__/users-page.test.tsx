import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UsersPage } from '@/features/users/pages'
import { TestAuth, TestQuery, TestToast } from '@/test-support'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const sdk = vi.hoisted(() => ({
  teams: { list: vi.fn() },
  users: {
    archive: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    restore: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/config/sdk', () => ({ sdk }))

const jane = TestAuth.user({ firstName: 'Jane', id: 'u1', lastName: 'Doe' })
const john = TestAuth.user({ email: 'john@x.co', firstName: 'John', id: 'u2', lastName: 'Smith' })
const actions = TestToast.actions()
const Toast = TestToast.wrapper(actions)

function renderPage(role: 'admin' | 'manager' = 'admin') {
  return TestAuth.render(
    <Toast>
      <UsersPage />
    </Toast>,
    { role, user: { id: 'me', role }, route: '/users' },
  )
}

beforeEach(() => {
  TestQuery.reset()
  vi.clearAllMocks()
  sdk.teams.list.mockResolvedValue({ items: [], more: false, next: null, total: 0 })
  sdk.users.list.mockResolvedValue({ items: [jane, john], more: false, next: null, total: 2 })
})

describe('UsersPage states', () => {
  it('shows a skeleton while loading', () => {
    sdk.users.list.mockReturnValue(new Promise(() => undefined))
    renderPage()
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('renders the loaded users', async () => {
    renderPage()
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('John Smith')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'title' })).toBeInTheDocument()
  })

  it('shows the empty state', async () => {
    sdk.users.list.mockResolvedValue({ items: [], more: false, next: null, total: 0 })
    renderPage()
    expect(await screen.findByText('empty.title')).toBeInTheDocument()
  })

  it('shows an error state with retry', async () => {
    sdk.users.list.mockRejectedValue(new Error('boom'))
    renderPage()
    const retry = await screen.findByRole('button', { name: 'error.retry' })
    sdk.users.list.mockResolvedValue({ items: [jane], more: false, next: null, total: 1 })
    await userEvent.click(retry)
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
  })

  it('filters the loaded page client-side', async () => {
    renderPage()
    await screen.findByText('Jane Doe')
    await userEvent.type(screen.getByRole('searchbox'), 'smith')
    await waitFor(() => {
      expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument()
    })
    expect(screen.getByText('John Smith')).toBeInTheDocument()
  })
})

describe('UsersPage permissions', () => {
  it('shows create and the role filter to admins', async () => {
    renderPage('admin')
    await screen.findByText('Jane Doe')
    expect(screen.getAllByRole('button', { name: 'actions.create' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('combobox', { name: 'filters.role' })).toBeInTheDocument()
  })

  it('hides the role filter from managers and offers no delete', async () => {
    renderPage('manager')
    await screen.findByText('Jane Doe')
    expect(screen.queryByRole('combobox', { name: 'filters.role' })).not.toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('checkbox')[0]!)
    expect(screen.queryByRole('button', { name: 'bulk.delete' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'bulk.archive' })).toBeInTheDocument()
  })
})

describe('UsersPage bulk actions', () => {
  it('never deletes before the confirm dialog is accepted and the undo window ends', async () => {
    sdk.users.delete.mockResolvedValue({ deleted: ['u1'], failed: [], success: true })
    renderPage()
    await screen.findByText('Jane Doe')
    await userEvent.click(screen.getAllByRole('checkbox', { name: 'list.select' })[0]!)
    await userEvent.click(screen.getByRole('button', { name: 'bulk.delete' }))
    expect(sdk.users.delete).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'actions.cancel' }))
    expect(sdk.users.delete).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'bulk.delete' }))
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'actions.delete' }),
    )
    expect(actions.showUndo).toHaveBeenCalledTimes(1)
    expect(sdk.users.delete).not.toHaveBeenCalled()
    const onUndo = vi.mocked(actions.showUndo).mock.calls[0]?.[1]
    expect(onUndo).toBeTypeOf('function')
    await act(async () => {
      onUndo?.()
      await Promise.resolve()
    })
    expect(sdk.users.delete).not.toHaveBeenCalled()
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
  })

  it('archives after confirmation and toasts failed items', async () => {
    sdk.users.archive.mockResolvedValue({ user: jane })
    renderPage()
    await screen.findByText('Jane Doe')
    await userEvent.click(screen.getAllByRole('checkbox')[0]!)
    await userEvent.click(screen.getByRole('button', { name: 'bulk.archive' }))
    expect(sdk.users.archive).not.toHaveBeenCalled()
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'actions.archive' }),
    )
    await waitFor(() => {
      expect(sdk.users.archive).toHaveBeenCalledWith(expect.any(String))
    })
    await waitFor(() => {
      expect(actions.showSuccess).toHaveBeenCalledTimes(1)
    })
  })
})
