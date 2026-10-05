import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'

import './index.css'
import { OfflineBanner } from '@/components/pwa/offline-banner'
import { UpdatePrompt } from '@/components/pwa/update-prompt'
import { AppProviders } from '@/providers'
import { router } from '@/router'

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element not found')
}

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
      <UpdatePrompt />
      <OfflineBanner />
    </AppProviders>
  </StrictMode>,
)
