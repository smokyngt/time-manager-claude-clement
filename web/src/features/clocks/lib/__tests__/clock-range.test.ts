import { describe, expect, it } from 'vitest'

import { ClockRange } from '@/features/clocks/lib/clock-range'

const NOW = new Date('2026-01-07T10:00:00').getTime()

describe('ClockRange', () => {
  it('parses presets with a fallback', () => {
    expect(ClockRange.parse('today')).toBe('today')
    expect(ClockRange.parse('nope')).toBe('this_week')
  })

  it('resolves today', () => {
    const range = ClockRange.resolve('today', '', '', NOW)
    expect(range?.from).toBe(new Date('2026-01-07T00:00:00').getTime())
    expect(range?.to).toBeGreaterThan(NOW)
  })

  it('resolves weeks starting on Monday', () => {
    expect(ClockRange.resolve('this_week', '', '', NOW)?.from).toBe(
      new Date('2026-01-05T00:00:00').getTime(),
    )
    expect(ClockRange.resolve('last_week', '', '', NOW)?.from).toBe(
      new Date('2025-12-29T00:00:00').getTime(),
    )
  })

  it('resolves a custom range inclusively', () => {
    const range = ClockRange.resolve('custom', '2026-01-01', '2026-01-02', NOW)
    expect(range?.from).toBe(new Date('2026-01-01T00:00:00').getTime())
    expect(range?.to).toBe(new Date('2026-01-02T23:59:59.999').getTime())
  })

  it('returns null for incomplete or reversed custom ranges', () => {
    expect(ClockRange.resolve('custom', '', '', NOW)).toBeNull()
    expect(ClockRange.resolve('custom', '2026-01-03', '2026-01-02', NOW)).toBeNull()
  })
})
