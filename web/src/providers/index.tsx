import type { ReactNode } from 'react'

import { QueryClientProvider } from '@tanstack/react-query'

import { queryClient } from '@/config/query'
import { AuthProvider } from '@/providers/auth-provider'
import { ErrorBoundary } from '@/providers/error-boundary'
import { I18nProvider } from '@/providers/i18n-provider'
import { ThemeProvider } from '@/providers/theme-provider'
import { ToastProvider } from '@/providers/toast-provider'

export { AuthProvider } from '@/providers/auth-provider'
export { ErrorBoundary } from '@/providers/error-boundary'
export { I18nProvider } from '@/providers/i18n-provider'
export { ThemeProvider } from '@/providers/theme-provider'
export { ToastProvider } from '@/providers/toast-provider'
export { useAuth } from '@/providers/use-auth'
export { useTheme } from '@/providers/use-theme'
export { useToastActions } from '@/providers/use-toast-actions'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <AuthProvider>{children}</AuthProvider>
            </ToastProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </I18nProvider>
    </ErrorBoundary>
  )
}
