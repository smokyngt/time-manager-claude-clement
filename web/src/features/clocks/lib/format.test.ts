import { describe, expect, it } from 'vitest'

import {
  elapsedSeconds,
  formatDurationMs,
  formatTimer,
  fromInputValue,
  toInputValue,
} from '@/features/clocks/lib/format'
import { customRange, presetRange } from '@/features/clocks/lib/ranges'

describe('formatDurationMs', () => {
  it('formats hours and minutes', () => {
    expect(formatDurationMs(7 * 3_600_000 + 5 * 60_000)).toBe('7h 05m')
  })

  it('formats under an hour', () => {
    expect(formatDurationMs(12 * 60_000)).toBe('12m')
  })

  it('returns a dash for open clocks', () => {
    expect(formatDurationMs(null)).toBe('-')
  })
})

describe('formatTimer', () => {
  it('pads every unit', () => {
    expect(formatTimer(3661)).toBe('01:01:01')
    expect(formatTimer(0)).toBe('00:00:00')
  })
})

describe('elapsedSeconds', () => {
  it('floors and never goes negative', () => {
    expect(elapsedSeconds(1000, 4999)).toBe(3)
    expect(elapsedSeconds(5000, 1000)).toBe(0)
  })
})

describe('input values', () => {
  it('round-trips a local datetime', () => {
    const value = '2026-03-02T09:30'
    expect(toInputValue(fromInputValue(value))).toBe(value)
  })
})

describe('ranges', () => {
  it('builds a Monday to Sunday week', () => {
    const { from, to } = presetRange('this_week', new Date('2026-10-07T12:00'))
    expect(new Date(from).getDay()).toBe(1)
    expect(new Date(to).getDay()).toBe(0)
  })

  it('builds the previous week', () => {
    const now = new Date('2026-10-07T12:00')
    expect(presetRange('last_week', now).to).toBeLessThan(presetRange('this_week', now).from)
  })

  it('rejects incomplete or inverted custom ranges', () => {
    expect(customRange('', '2026-10-01')).toBeNull()
    expect(customRange('2026-10-05', '2026-10-01')).toBeNull()
    expect(customRange('2026-10-01', '2026-10-05')).not.toBeNull()
  })
})
