import type { ReactNode } from 'react'

import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'

import type { ToastActions } from '@/providers/use-toast-actions'

import { Toaster } from '@/components/ui/sonner'
import { QueryEvents } from '@/config/query'
import { i18n } from '@/lib/i18n'
import { ToastContext } from '@/providers/use-toast-actions'

export const UNDO_TOAST_DURATION = 6000

export function ToastProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const unsubscribeErrors = QueryEvents.errors((event) => {
      toast.error(i18n.t('common:toast.error'), { description: event.message })
    })
    const unsubscribeSuccess = QueryEvents.success((event) => {
      toast.success(event.message)
    })
    return () => {
      unsubscribeErrors()
      unsubscribeSuccess()
    }
  }, [])

  const actions = useMemo<ToastActions>(
    () => ({
      dismiss: (id) => {
        toast.dismiss(id)
      },
      showError: (title, description) => {
        toast.error(title, { description })
      },
      showInfo: (title, description) => {
        toast.info(title, { description })
      },
      showSuccess: (title, description) => {
        toast.success(title, { description })
      },
      showUndo: (message, onUndo, options) =>
        toast(message, {
          action: { label: i18n.t('common:undo.action'), onClick: onUndo },
          duration: options?.duration ?? UNDO_TOAST_DURATION,
        }),
    }),
    [],
  )

  return (
    <ToastContext value={actions}>
      {children}
      <Toaster />
    </ToastContext>
  )
}
