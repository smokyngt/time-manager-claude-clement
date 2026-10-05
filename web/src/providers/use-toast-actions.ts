import { createContext, use } from 'react'

export type ToastActions = {
  dismiss: (id?: number | string) => void
  showError: (title: string, description?: string) => void
  showInfo: (title: string, description?: string) => void
  showSuccess: (title: string, description?: string) => void
  showUndo: (message: string, onUndo: () => void, options?: { duration?: number }) => number | string
}

export const ToastContext = createContext<null | ToastActions>(null)

export function useToastActions() {
  const context = use(ToastContext)
  if (!context) {
    throw new Error('useToastActions must be used within ToastProvider')
  }
  return context
}
