import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'

import './index.css'
import { OfflineBanner } from '@/components/pwa/offline-banner'
import { UpdatePrompt } from '@/components/pwa/update-prompt'
import { Toaster } from '@/components/ui/sonner'
import { queryClient } from '@/lib/query-client'
import { ThemeProvider } from '@/lib/theme/theme-provider'
import { router } from '@/routes'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
        <UpdatePrompt />
        <OfflineBanner />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
