import { describe, expect, it } from 'vitest'

import type { PeriodState } from '@/features/reports/lib/period'

import { DEFAULT_PERIOD_STATE, resolvePeriod } from '@/features/reports/lib/period'

const NOW = new Date(2026, 9, 7, 12, 0, 0)

function state(overrides: Partial<PeriodState>): PeriodState {
  return { ...DEFAULT_PERIOD_STATE, ...overrides }
}

describe('resolvePeriod', () => {
  it('resolves this week from Monday to Sunday by day', () => {
    const result = resolvePeriod(state({ preset: 'this_week' }), NOW)
    expect(result.from).toBe(new Date(2026, 9, 5, 0, 0, 0, 0).getTime())
    expect(result.to).toBe(new Date(2026, 9, 11, 23, 59, 59, 999).getTime())
    expect(result.granularity).toBe('day')
    expect(result.error).toBeNull()
  })

  it('resolves last 4 weeks', () => {
    const result = resolvePeriod(state({ preset: 'last_4_weeks' }), NOW)
    expect(result.from).toBe(new Date(2026, 8, 14).getTime())
    expect(result.to).toBe(new Date(2026, 9, 11, 23, 59, 59, 999).getTime())
    expect(result.granularity).toBe('day')
  })

  it('resolves this month by day', () => {
    const result = resolvePeriod(state({ preset: 'this_month' }), NOW)
    expect(result.from).toBe(new Date(2026, 9, 1).getTime())
    expect(result.to).toBe(new Date(2026, 9, 31, 23, 59, 59, 999).getTime())
    expect(result.granularity).toBe('day')
  })

  it('resolves last 3 months by week', () => {
    const result = resolvePeriod(state({ preset: 'last_3_months' }), NOW)
    expect(result.from).toBe(new Date(2026, 7, 1).getTime())
    expect(result.to).toBe(new Date(2026, 9, 31, 23, 59, 59, 999).getTime())
    expect(result.granularity).toBe('week')
  })

  it('lets the user override the granularity', () => {
    const result = resolvePeriod(state({ granularity: 'month', preset: 'last_3_months' }), NOW)
    expect(result.granularity).toBe('month')
  })

  it('resolves a custom range and picks month for long spans', () => {
    const result = resolvePeriod(
      state({ from: '2026-01-01', to: '2026-09-30', preset: 'custom' }),
      NOW,
    )
    expect(result.from).toBe(new Date(2026, 0, 1).getTime())
    expect(result.to).toBe(new Date(2026, 8, 30, 23, 59, 59, 999).getTime())
    expect(result.granularity).toBe('month')
  })

  it('rejects invalid custom ranges', () => {
    expect(resolvePeriod(state({ preset: 'custom' }), NOW).error).toBe('range_required')
    expect(
      resolvePeriod(
        state({ from: '2026-02-01', to: '2026-01-01', preset: 'custom' }),
        NOW,
      ).error,
    ).toBe('range_order')
    expect(
      resolvePeriod(
        state({ from: '2024-01-01', to: '2026-01-01', preset: 'custom' }),
        NOW,
      ).error,
    ).toBe('range_too_long')
  })
})
