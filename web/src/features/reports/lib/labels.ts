import { format } from 'date-fns'

import type { Granularity } from '@/features/reports/api/types'

export function formatPeriodLabel(period_start: number, granularity: Granularity) {
  if (granularity === 'day') return format(period_start, 'EEE d MMM')
  if (granularity === 'week') return `Week of ${format(period_start, 'd MMM')}`
  return format(period_start, 'MMM yyyy')
}

export function formatShortPeriodLabel(period_start: number, granularity: Granularity) {
  if (granularity === 'day') return format(period_start, 'd MMM')
  if (granularity === 'week') return format(period_start, 'd MMM')
  return format(period_start, 'MMM')
}

export function formatRange(from: number, to: number) {
  return `${format(from, 'd MMM yyyy')} to ${format(to, 'd MMM yyyy')}`
}
