import { describe, expect, it } from 'vitest'

import { formatDuration, formatPercent, formatSignedDuration } from '@/features/reports/lib/format'

const HOUR = 3_600_000
const MINUTE = 60_000

describe('formatDuration', () => {
  it('formats hours and minutes', () => {
    expect(formatDuration(7 * HOUR + 12 * MINUTE)).toBe('7h 12m')
  })

  it('formats under one hour and zero', () => {
    expect(formatDuration(45 * MINUTE)).toBe('45m')
    expect(formatDuration(0)).toBe('0m')
  })

  it('rolls minutes over', () => {
    expect(formatDuration(59.6 * MINUTE)).toBe('1h 0m')
  })
})

describe('formatSignedDuration', () => {
  it('adds a sign', () => {
    expect(formatSignedDuration(2 * HOUR)).toBe('+2h 0m')
    expect(formatSignedDuration(-90 * MINUTE)).toBe('-1h 30m')
    expect(formatSignedDuration(0)).toBe('0m')
  })
})

describe('formatPercent', () => {
  it('formats rates', () => {
    expect(formatPercent(0.25)).toBe('25%')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(1 / 30)).toBe('3.3%')
  })
})
