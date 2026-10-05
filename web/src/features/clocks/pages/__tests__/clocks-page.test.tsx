import type { Clock } from '@time-manager/sdk'

import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ClocksPage } from '@/features/clocks/pages/clocks-page'
import { ToastContext } from '@/providers/use-toast-actions'
import { TestAuth, TestClock, TestQuery, TestToast } from '@/test-support'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

const sdk = vi.hoisted(() => ({
  clocks: { delete: vi.fn(), list: vi.fn() },
  users: { list: vi.fn() },
}))

vi.mock('@/config/sdk', () => ({ sdk }))

function clock(id: string): Clock {
  return {
    clockedInAt: new Date('2026-01-05T08:00').getTime(),
    clockedOutAt: new Date('2026-01-05T09:00').getTime(),
    createdAt: 1,
    durationMs: 3_600_000,
    id,
    note: null,
    object: 'clock',
    source: 'clock',
    updatedAt: null,
    userId: 'u1',
  }
}

function page(items: Clock[]) {
  return { items, more: false, next: null, total: items.length }
}

function renderPage(role: 'employee' | 'manager', toasts = TestToast.actions()) {
  return TestAuth.render(
    <ToastContext value={toasts}>
      <ClocksPage />
    </ToastContext>,
    { role, route: '/clocks' },
  )
}

describe('ClocksPage', () => {
  beforeEach(() => {
    TestQuery.reset()
    sdk.clocks.list.mockReset()
    sdk.clocks.delete.mockReset()
    sdk.users.list.mockReset()
    sdk.users.list.mockResolvedValue(page([]))
  })

  afterEach(() => {
    TestClock.restore()
  })

  it('shows skeletons while loading', () => {
    sdk.clocks.list.mockReturnValue(new Promise(() => undefined))
    renderPage('employee')
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('shows the empty state', async () => {
    sdk.clocks.list.mockResolvedValue(page([]))
    renderPage('employee')
    expect(await screen.findByText('empty.title')).toBeInTheDocument()
  })

  it('shows the error state with retry', async () => {
    sdk.clocks.list.mockRejectedValue(new Error('boom'))
    renderPage('employee')
    expect(await screen.findByText('error.title')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'error.retry' })).toBeInTheDocument()
  })

  it('hides every write action without the manage scope', async () => {
    sdk.clocks.list.mockResolvedValue(page([clock('c1')]))
    renderPage('employee')
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /actions\.(add|edit|delete)/ })).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByLabelText('toolbar.user')).toBeNull()
  })

  it('shows write actions for a manager', async () => {
    sdk.clocks.list.mockResolvedValue(page([clock('c1')]))
    renderPage('manager')
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'actions.add' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'actions.edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'actions.delete' })).toBeInTheDocument()
  })

  it('does not call the SDK before the undo window ends on bulk delete', async () => {
    sdk.clocks.list.mockResolvedValue(page([clock('c1'), clock('c2')]))
    sdk.clocks.delete.mockResolvedValue({ deleted: ['c1', 'c2'], failed: [], success: true })
    const toasts = TestToast.actions()
    renderPage('manager', toasts)
    await screen.findByRole('table')
    const user = userEvent.setup({ delay: null })

    await user.click(screen.getByRole('checkbox', { name: 'table.select_all' }))
    await user.click(screen.getByRole('button', { name: 'actions.delete_selected' }))
    TestClock.install()
    fireEvent.click(screen.getByRole('button', { name: 'bulk.confirm' }))

    await act(async () => {
      await TestClock.advance(0)
    })
    expect(toasts.showUndo).toHaveBeenCalled()
    expect(sdk.clocks.delete).not.toHaveBeenCalled()
    expect(screen.queryByRole('table')).toBeNull()

    await act(async () => {
      await TestClock.advance(6500)
    })
    expect(sdk.clocks.delete).toHaveBeenCalledWith(['c1', 'c2'])
  })

  it('restores the rows and never calls the SDK when undone', async () => {
    sdk.clocks.list.mockResolvedValue(page([clock('c1')]))
    const toasts = TestToast.actions()
    renderPage('manager', toasts)
    await screen.findByRole('table')
    TestClock.install()

    await act(async () => {
      screen.getByRole('button', { name: 'actions.delete' }).click()
      await TestClock.advance(0)
    })
    const onUndo = vi.mocked(toasts.showUndo).mock.calls[0]?.[1]
    await act(async () => {
      onUndo?.()
      await TestClock.advance(7000)
    })
    expect(sdk.clocks.delete).not.toHaveBeenCalled()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})
