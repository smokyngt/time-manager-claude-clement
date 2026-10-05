import type { Granularity } from '@time-manager/sdk'

import { Duration } from '@/lib/duration'

export type ChartPoint = {
  periodStart: number
  targetHours: null | number
  workedHours: number
}

export type SeriesPoint = {
  periodStart: number
  workedMs: number
}

export type SeriesRange = {
  from: number
  granularity: Granularity
  now: number
  targetMs?: number
  to: number
}

export function nextPeriodStart(start: number, granularity: Granularity) {
  const date = new Date(start)
  if (granularity === 'day') {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime()
  }
  if (granularity === 'week') {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7).getTime()
  }
  return new Date(date.getFullYear(), date.getMonth() + 1, date.getDate()).getTime()
}

export function countWeekdays(start: number, end: number) {
  let count = 0
  const first = new Date(start)
  let day = new Date(first.getFullYear(), first.getMonth(), first.getDate())
  while (day.getTime() <= end) {
    const weekday = day.getDay()
    if (weekday !== 0 && weekday !== 6) {
      count += 1
    }
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  }
  return count
}

export function elapsedFraction(from: number, to: number, now: number) {
  const total = countWeekdays(from, to)
  if (total === 0) {
    return 0
  }
  return countWeekdays(from, Math.min(to, now)) / total
}

export function buildChartPoints(series: SeriesPoint[], range: SeriesRange): ChartPoint[] {
  const total = countWeekdays(range.from, range.to)
  return series.map((point, index) => {
    const next =
      series[index + 1]?.periodStart ?? nextPeriodStart(point.periodStart, range.granularity)
    const start = Math.max(point.periodStart, range.from)
    const end = Math.min(next - 1, range.to, range.now)
    const weekdays = end < start ? 0 : countWeekdays(start, end)
    return {
      periodStart: point.periodStart,
      targetHours:
        range.targetMs === undefined || total === 0
          ? null
          : Duration.toHours((range.targetMs * weekdays) / total, 2),
      workedHours: Duration.toHours(point.workedMs, 2),
    }
  })
}
