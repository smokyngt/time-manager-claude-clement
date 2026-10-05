import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AppProviders } from '@/providers'
import { useAuth } from '@/providers/use-auth'

const sdk = vi.hoisted(() => ({
  auth: { logout: vi.fn(), me: vi.fn(), refresh: vi.fn(() => Promise.reject(new Error('none'))) },
}))

vi.mock('@/config/sdk', () => ({ sdk }))
vi.mock('sonner', () => ({ toast: vi.fn(), Toaster: () => null }))

function Status() {
  const { status } = useAuth()
  return <p>status:{status}</p>
}

describe('AppProviders', () => {
  it('composes the providers around the app', async () => {
    render(
      <AppProviders>
        <Status />
      </AppProviders>,
    )
    expect(await screen.findByText('status:unauthenticated')).toBeInTheDocument()
  })
})
