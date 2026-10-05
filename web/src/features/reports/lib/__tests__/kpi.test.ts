import { describe, expect, it } from 'vitest'

import {
  formatPercent,
  overtimeTone,
  signedDuration,
  userOvertime,
} from '@/features/reports/lib/kpi'
import { buildChartPoints, countWeekdays } from '@/features/reports/lib/series'
import { sortMembers } from '@/features/reports/lib/sort-members'

const HOUR = 3_600_000

describe('signedDuration', () => {
  it('signs negative and positive values', () => {
    expect(signedDuration(-3.5 * HOUR)).toBe('-3h 30m')
    expect(signedDuration(2 * HOUR)).toBe('+2h 00m')
  })

  it('leaves zero unsigned', () => {
    expect(signedDuration(0)).toBe('0m')
    expect(signedDuration(-20_000)).toBe('0m')
  })
})

describe('formatPercent', () => {
  it('formats a rate', () => {
    expect(formatPercent(0.25, 'en')).toBe('25%')
    expect(formatPercent(0.125, 'en')).toBe('12.5%')
  })
})

describe('overtimeTone', () => {
  it('is neutral while the period is running', () => {
    expect(overtimeTone(-35 * HOUR, false)).toBeUndefined()
  })

  it('colors a complete period', () => {
    expect(overtimeTone(-HOUR, true)).toBe('negative')
    expect(overtimeTone(HOUR, true)).toBe('positive')
    expect(overtimeTone(0, true)).toBeUndefined()
  })
})

describe('userOvertime', () => {
  const monday = new Date(2026, 9, 5).getTime()
  const sunday = new Date(2026, 9, 11, 23, 59, 59, 999).getTime()
  const kpis = { overtimeMs: -35 * HOUR, targetMs: 35 * HOUR, workedMs: 0 }

  it('keeps the API value once the period is over', () => {
    expect(userOvertime(kpis, { from: monday, now: sunday + 1, to: sunday })).toBe(-35 * HOUR)
  })

  it('bases the target on working days elapsed', () => {
    const wednesday = new Date(2026, 9, 7, 12).getTime()
    const result = userOvertime(
      { ...kpis, workedMs: 20 * HOUR },
      { from: monday, now: wednesday, to: sunday },
    )
    expect(result).toBe(20 * HOUR - 21 * HOUR)
  })
})

describe('series', () => {
  it('counts weekdays', () => {
    expect(countWeekdays(new Date(2026, 9, 5).getTime(), new Date(2026, 9, 11, 23).getTime())).toBe(
      5,
    )
  })

  it('spreads the target over elapsed weekdays only', () => {
    const from = new Date(2026, 9, 5).getTime()
    const to = new Date(2026, 9, 11, 23, 59, 59, 999).getTime()
    const series = Array.from({ length: 7 }, (_, index) => ({
      periodStart: new Date(2026, 9, 5 + index).getTime(),
      workedMs: index === 0 ? 8 * HOUR : 0,
    }))
    const points = buildChartPoints(series, {
      from,
      granularity: 'day',
      now: new Date(2026, 9, 6, 12).getTime(),
      targetMs: 35 * HOUR,
      to,
    })
    expect(points[0]).toMatchObject({ targetHours: 7, workedHours: 8 })
    expect(points[1]?.targetHours).toBe(7)
    expect(points[2]?.targetHours).toBe(0)
  })
})

describe('sortMembers', () => {
  const member = (userId: string, workedMs: number) => ({
    daysWorked: 1,
    firstName: userId,
    lastName: '',
    lateDays: 0,
    overtimeMs: 0,
    userId,
    workedMs,
  })

  it('sorts without mutating', () => {
    const members = [member('a', 1), member('b', 3), member('c', 2)]
    expect(sortMembers(members, 'workedMs', 'desc').map((m) => m.userId)).toEqual(['b', 'c', 'a'])
    expect(sortMembers(members, 'workedMs', 'asc').map((m) => m.userId)).toEqual(['a', 'c', 'b'])
    expect(members[0]?.userId).toBe('a')
  })
})
