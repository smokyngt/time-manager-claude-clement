import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { UserKpis } from '@/features/reports/api/types'

import { KpiGrid } from '@/features/reports/components/kpi-grid'

const HOUR = 3_600_000

const KPIS: UserKpis = {
  average_daily_ms: 7.2 * HOUR,
  days_worked: 4,
  late_days: 1,
  lateness_rate: 0.25,
  overtime_ms: -3.5 * HOUR,
  target_ms: 32 * HOUR,
  worked_ms: 28.5 * HOUR,
}

describe('KpiGrid', () => {
  it('renders formatted values', () => {
    render(<KpiGrid kpis={KPIS} />)
    expect(screen.getByText('28h 30m')).toBeInTheDocument()
    expect(screen.getByText('7h 12m')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
    expect(screen.getByText('of 32h 0m target')).toBeInTheDocument()
  })

  it('renders negative overtime with a sign and the destructive tone', () => {
    render(<KpiGrid kpis={KPIS} />)
    const overtime = screen.getByText('-3h 30m')
    expect(overtime).toHaveClass('text-destructive')
    expect(screen.getByText('under target')).toBeInTheDocument()
  })

  it('renders positive overtime with a plus sign', () => {
    render(<KpiGrid kpis={{ ...KPIS, overtime_ms: 2 * HOUR }} />)
    expect(screen.getByText('+2h 0m')).toBeInTheDocument()
  })
})
