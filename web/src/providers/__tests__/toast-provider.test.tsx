import type { ReactNode } from 'react'

import { act, render, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { QueryEvents } from '@/config/query'
import { ThemeProvider } from '@/providers/theme-provider'
import { ToastProvider } from '@/providers/toast-provider'
import { useToastActions } from '@/providers/use-toast-actions'

const toast = vi.hoisted(() => {
  const fn = Object.assign(
    vi.fn(() => 'id'),
    {
      dismiss: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
    },
  )
  return fn
})

vi.mock('sonner', () => ({ toast, Toaster: () => null }))

function Capture() {
  useToastActions()
  return null
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
)

function setup() {
  return renderHook(() => useToastActions(), { wrapper }).result
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    QueryEvents.clear()
  })

  it('toasts QueryEvents errors with the translated text', () => {
    setup()
    act(() => {
      QueryEvents.emitError({ error: 1, message: 'Boom', source: 'query' })
    })
    expect(toast.error).toHaveBeenCalledWith('Error', { description: 'Boom' })
  })

  it('toasts QueryEvents successes', () => {
    setup()
    act(() => {
      QueryEvents.emitSuccess({ message: 'Saved' })
    })
    expect(toast.success).toHaveBeenCalledWith('Saved')
  })

  it('exposes imperative actions', () => {
    const actions = setup().current
    actions.showError('Title', 'Detail')
    actions.showSuccess('Done')
    actions.showInfo('Info', 'More')
    actions.dismiss('id')
    expect(toast.error).toHaveBeenCalledWith('Title', { description: 'Detail' })
    expect(toast.success).toHaveBeenCalledWith('Done', { description: undefined })
    expect(toast.info).toHaveBeenCalledWith('Info', { description: 'More' })
    expect(toast.dismiss).toHaveBeenCalledWith('id')
  })

  it('shows an undo toast with an action', () => {
    const actions = setup().current
    const onUndo = vi.fn()
    actions.showUndo('Deleted', onUndo)
    expect(toast).toHaveBeenCalledWith(
      'Deleted',
      expect.objectContaining({ action: { label: 'Undo', onClick: onUndo }, duration: 6000 }),
    )
  })

  it('stops listening on unmount', () => {
    const view = renderHook(() => useToastActions(), { wrapper })
    view.unmount()
    act(() => {
      QueryEvents.emitSuccess({ message: 'x' })
    })
    expect(toast.success).not.toHaveBeenCalled()
  })
})

describe('useToastActions', () => {
  it('throws outside ToastProvider', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<Capture />)).toThrow('useToastActions must be used within ToastProvider')
    error.mockRestore()
  })
})
