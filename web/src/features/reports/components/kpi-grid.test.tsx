import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { UserReportKpis } from '@time-manager/sdk'

import { KpiGrid } from '@/features/reports/components/kpi-grid'

const HOUR = 3_600_000

const NOW = HOUR
const RANGE = { from: 0, to: HOUR }

const KPIS: UserReportKpis = {
  averageDailyMs: 7.2 * HOUR,
  daysWorked: 4,
  lateDays: 1,
  latenessRate: 0.25,
  overtimeMs: -3.5 * HOUR,
  targetMs: 32 * HOUR,
  workedMs: 28.5 * HOUR,
}

describe('KpiGrid', () => {
  it('renders formatted values', () => {
    render(<KpiGrid kpis={KPIS} now={NOW} range={RANGE} />)
    expect(screen.getByText('28h 30m')).toBeInTheDocument()
    expect(screen.getByText('7h 12m')).toBeInTheDocument()
    expect(screen.getByText(/25\s*%/)).toBeInTheDocument()
  })

  it('renders negative overtime with a sign and the destructive tone', () => {
    render(<KpiGrid kpis={KPIS} now={NOW} range={RANGE} />)
    const overtime = screen.getByText('-3h 30m')
    expect(overtime).toHaveClass('text-destructive')
  })

  it('renders positive overtime with a plus sign', () => {
    render(<KpiGrid kpis={{ ...KPIS, overtimeMs: 2 * HOUR }} now={NOW} range={RANGE} />)
    expect(screen.getByText('+2h 00m')).toBeInTheDocument()
  })
})
