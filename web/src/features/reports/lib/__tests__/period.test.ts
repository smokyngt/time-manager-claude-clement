import { describe, expect, it } from 'vitest'

import type { PeriodState } from '@/features/reports/lib/period'

import {
  autoGranularity,
  DEFAULT_PERIOD_STATE,
  isGranularityChoice,
  isPreset,
  resolvePeriod,
} from '@/features/reports/lib/period'

const NOW = new Date(2026, 9, 7, 12, 0, 0)

function state(overrides: Partial<PeriodState>): PeriodState {
  return { ...DEFAULT_PERIOD_STATE, ...overrides }
}

describe('resolvePeriod', () => {
  it('resolves this week from Monday to Sunday by day', () => {
    const result = resolvePeriod(state({ preset: 'this_week' }), NOW)
    expect(result.from).toBe(new Date(2026, 9, 5).getTime())
    expect(result.to).toBe(new Date(2026, 9, 11, 23, 59, 59, 999).getTime())
    expect(result.granularity).toBe('day')
    expect(result.error).toBeNull()
  })

  it('resolves the last 4 weeks', () => {
    const result = resolvePeriod(state({ preset: 'last_4_weeks' }), NOW)
    expect(result.from).toBe(new Date(2026, 8, 14).getTime())
    expect(result.to).toBe(new Date(2026, 9, 11, 23, 59, 59, 999).getTime())
    expect(result.granularity).toBe('day')
  })

  it('resolves this month', () => {
    const result = resolvePeriod(state({ preset: 'this_month' }), NOW)
    expect(result.from).toBe(new Date(2026, 9, 1).getTime())
    expect(result.to).toBe(new Date(2026, 9, 31, 23, 59, 59, 999).getTime())
  })

  it('resolves the last 3 months by week', () => {
    const result = resolvePeriod(state({ preset: 'last_3_months' }), NOW)
    expect(result.from).toBe(new Date(2026, 7, 1).getTime())
    expect(result.granularity).toBe('week')
  })

  it('honours a granularity override', () => {
    expect(resolvePeriod(state({ granularity: 'month' }), NOW).granularity).toBe('month')
  })

  it('resolves a custom range', () => {
    const result = resolvePeriod(
      state({ from: '2026-01-01', preset: 'custom', to: '2026-12-31' }),
      NOW,
    )
    expect(result.from).toBe(new Date(2026, 0, 1).getTime())
    expect(result.to).toBe(new Date(2026, 11, 31, 23, 59, 59, 999).getTime())
    expect(result.granularity).toBe('month')
    expect(result.error).toBeNull()
  })

  it('flags missing, reversed and oversized custom ranges', () => {
    expect(resolvePeriod(state({ preset: 'custom' }), NOW).error).toBe('range_required')
    expect(
      resolvePeriod(state({ from: '2026-02-02', preset: 'custom', to: '2026-02-01' }), NOW).error,
    ).toBe('range_order')
    expect(
      resolvePeriod(state({ from: '2025-01-01', preset: 'custom', to: '2026-12-31' }), NOW).error,
    ).toBe('range_too_long')
  })
})

describe('autoGranularity', () => {
  it('picks day, week then month by span', () => {
    const start = new Date(2026, 0, 1).getTime()
    expect(autoGranularity(start, new Date(2026, 0, 31).getTime())).toBe('day')
    expect(autoGranularity(start, new Date(2026, 3, 1).getTime())).toBe('week')
    expect(autoGranularity(start, new Date(2026, 11, 31).getTime())).toBe('month')
  })
})

describe('guards', () => {
  it('accepts only known values', () => {
    expect(isPreset('custom')).toBe(true)
    expect(isPreset('nope')).toBe(false)
    expect(isGranularityChoice('auto')).toBe(true)
    expect(isGranularityChoice('week')).toBe(true)
    expect(isGranularityChoice('year')).toBe(false)
  })
})
