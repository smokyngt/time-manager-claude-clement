import { describe, expect, it } from 'vitest'

import { Duration } from '@/lib/duration'

describe('Duration', () => {
  it('formats HH:MM:SS', () => {
    expect(Duration.format(0)).toBe('00:00:00')
    expect(Duration.format(3_723_000)).toBe('01:02:03')
    expect(Duration.format(-5)).toBe('00:00:00')
    expect(Duration.format(100 * 3_600_000)).toBe('100:00:00')
  })

  it('formats short durations', () => {
    expect(Duration.short(42 * 60_000)).toBe('42m')
    expect(Duration.short(8 * 3_600_000 + 5 * 60_000)).toBe('8h 05m')
  })

  it('converts hours', () => {
    expect(Duration.toHours(5_400_000)).toBe(1.5)
    expect(Duration.toHours(1_234_567, 2)).toBe(0.34)
    expect(Duration.fromHours(1.5)).toBe(5_400_000)
  })

  it('never returns a negative elapsed time', () => {
    expect(Duration.elapsed(1000, 4000)).toBe(3000)
    expect(Duration.elapsed(4000, 1000)).toBe(0)
  })
})
