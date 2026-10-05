import type { ReactNode } from 'react'

import { vi } from 'vitest'

import type { QueryErrorEvent, QuerySuccessEvent } from '@/config/query'
import type { ToastActions } from '@/providers/use-toast-actions'

import { QueryEvents } from '@/config/query'
import { ToastContext } from '@/providers/use-toast-actions'

export type ToastCapture = {
  errors: QueryErrorEvent[]
  stop: () => void
  successes: QuerySuccessEvent[]
}

export class TestToast {
  /**
   * @route client.testSupport.testToast.actions
   * @returns {ToastActions} Spy implementation of `useToastActions()`.
   */
  static actions(): ToastActions {
    return {
      dismiss: vi.fn(),
      showError: vi.fn(),
      showInfo: vi.fn(),
      showSuccess: vi.fn(),
      showUndo: vi.fn(() => 'toast-id'),
    }
  }

  /**
   * @route client.testSupport.testToast.capture
   * @returns {ToastCapture} Collects global toasts emitted through QueryEvents.
   */
  static capture(): ToastCapture {
    const errors: QueryErrorEvent[] = []
    const successes: QuerySuccessEvent[] = []
    const stopErrors = QueryEvents.errors((event) => errors.push(event))
    const stopSuccess = QueryEvents.success((event) => successes.push(event))
    return {
      errors,
      stop: () => {
        stopErrors()
        stopSuccess()
      },
      successes,
    }
  }

  /**
   * @route client.testSupport.testToast.wrapper
   * @param {ToastActions} actions
   * @returns {(props: { children: ReactNode }) => ReactNode}
   */
  static wrapper(actions: ToastActions = TestToast.actions()) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return <ToastContext value={actions}>{children}</ToastContext>
    }
  }
}
