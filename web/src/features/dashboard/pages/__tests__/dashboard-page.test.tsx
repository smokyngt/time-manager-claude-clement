import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DashboardPage } from '@/features/dashboard/pages'
import { TestAuth, TestQuery } from '@/test-support'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())
vi.mock('@/features/clocks/components', () => ({ ClockCard: () => <div>clock-card</div> }))
vi.mock('@/features/reports/components', () => ({
  UserReportView: ({ userId }: { userId: string }) => <div>report-{userId}</div>,
}))

beforeEach(() => {
  TestQuery.reset()
})

describe('DashboardPage', () => {
  it('renders the greeting, the clock card and the personal report', () => {
    TestAuth.render(<DashboardPage />, { user: { id: 'me' } })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('greeting')
    expect(screen.getByText('clock-card')).toBeInTheDocument()
    expect(screen.getByText('report-me')).toBeInTheDocument()
  })

  it('hides the report section without the reports scope', () => {
    TestAuth.render(<DashboardPage />, { scopes: ['clocks:read'] })
    expect(screen.getByText('clock-card')).toBeInTheDocument()
    expect(screen.queryByText(/^report-/)).not.toBeInTheDocument()
  })
})
