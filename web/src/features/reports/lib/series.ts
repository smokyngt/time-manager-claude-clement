import { addDays, addMonths, addWeeks, getDay, startOfDay } from 'date-fns'

import type { Granularity } from '@/features/reports/api/types'

import { msToHours } from '@/features/reports/lib/format'

export interface ChartPoint {
  late: number
  period_start: number
  target_hours: null | number
  worked_hours: number
}

interface SourcePoint {
  late?: number
  period_start: number
  worked_ms: number
}

export function buildChartPoints(
  series: SourcePoint[],
  range: { from: number; granularity: Granularity; target_ms?: number; to: number },
) {
  const buckets = series.map((point, index) => {
    const next = series[index + 1]?.period_start ?? nextPeriodStart(point.period_start, range.granularity)
    const start = Math.max(point.period_start, range.from)
    const end = Math.min(next - 1, range.to)
    return { point, weekdays: countWeekdays(start, end) }
  })
  const total_weekdays = buckets.reduce((sum, bucket) => sum + bucket.weekdays, 0)
  return buckets.map(({ point, weekdays }): ChartPoint => ({
    late: point.late ?? 0,
    period_start: point.period_start,
    target_hours:
      range.target_ms === undefined || total_weekdays === 0
        ? null
        : msToHours((range.target_ms * weekdays) / total_weekdays),
    worked_hours: msToHours(point.worked_ms),
  }))
}

export function countWeekdays(start: number, end: number) {
  let count = 0
  for (let day = startOfDay(start); day.getTime() <= end; day = addDays(day, 1)) {
    const weekday = getDay(day)
    if (weekday !== 0 && weekday !== 6) count += 1
  }
  return count
}

export function nextPeriodStart(start: number, granularity: Granularity) {
  if (granularity === 'day') return addDays(start, 1).getTime()
  if (granularity === 'week') return addWeeks(start, 1).getTime()
  return addMonths(start, 1).getTime()
}
