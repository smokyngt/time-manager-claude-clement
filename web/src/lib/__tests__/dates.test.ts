import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { Dates } from '@/lib/dates'
import { i18n } from '@/lib/i18n'

describe('Dates', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en')
  })

  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('round-trips datetime-local values', () => {
    const value = new Date(2026, 0, 5, 9, 7).getTime()
    expect(Dates.toInput(value)).toBe('2026-01-05T09:07')
    expect(Dates.fromInput('2026-01-05T09:07')).toBe(value)
    expect(Dates.fromInput('nope')).toBeNull()
  })

  it('computes day and week bounds (weeks start on Monday)', () => {
    const wednesday = new Date(2026, 0, 7, 15, 30).getTime()
    expect(new Date(Dates.startOfDay(wednesday)).getHours()).toBe(0)
    expect(new Date(Dates.endOfDay(wednesday)).getHours()).toBe(23)
    expect(new Date(Dates.startOfWeek(wednesday)).getDate()).toBe(5)
    expect(new Date(Dates.endOfWeek(wednesday)).getDate()).toBe(11)
  })

  it('formats in the active language', async () => {
    const value = new Date(2026, 0, 5, 9, 0)
    expect(Dates.date(value)).toBe('Jan 5, 2026')
    await i18n.changeLanguage('fr')
    expect(Dates.date(value)).toContain('janv.')
  })

  it('detects future dates', () => {
    expect(Dates.isFuture(2000, 1000)).toBe(true)
    expect(Dates.isFuture(500, 1000)).toBe(false)
  })

  it('formats relative times', () => {
    expect(Dates.relative(1_000_000 - 3_600_000, 1_000_000)).toBe('1 hour ago')
    expect(Dates.relative(1_000_000 + 120_000, 1_000_000)).toBe('in 2 minutes')
  })

  it('formats time and date time', () => {
    const value = new Date(2026, 0, 5, 9, 5)
    expect(Dates.time(value)).toMatch(/9:05/)
    expect(Dates.dateTime(value)).toMatch(/Jan 5, 2026/)
  })
})
