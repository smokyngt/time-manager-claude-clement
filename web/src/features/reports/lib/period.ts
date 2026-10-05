import {
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'

import type { Granularity } from '@/features/reports/api/types'

export type PeriodPreset = 'custom' | 'last_3_months' | 'last_4_weeks' | 'this_month' | 'this_week'

export interface PeriodState {
  custom_from: string
  custom_to: string
  granularity: Granularity | null
  preset: PeriodPreset
}

export interface ResolvedPeriod {
  error: null | string
  from: number
  granularity: Granularity
  to: number
}

export const MAX_RANGE_DAYS = 366

export const PERIOD_PRESETS: { label: string; value: PeriodPreset }[] = [
  { label: 'This week', value: 'this_week' },
  { label: 'Last 4 weeks', value: 'last_4_weeks' },
  { label: 'This month', value: 'this_month' },
  { label: 'Last 3 months', value: 'last_3_months' },
  { label: 'Custom', value: 'custom' },
]

export const DEFAULT_PERIOD_STATE: PeriodState = {
  custom_from: '',
  custom_to: '',
  granularity: null,
  preset: 'this_week',
}

export function autoGranularity(from: number, to: number): Granularity {
  const days = differenceInCalendarDays(to, from) + 1
  if (days <= 31) return 'day'
  if (days <= 130) return 'week'
  return 'month'
}

export function resolvePeriod(state: PeriodState, now: Date): ResolvedPeriod {
  const range = state.preset === 'custom' ? customRange(state) : presetRange(state.preset, now)
  if (typeof range === 'string') {
    return { error: range, from: 0, granularity: state.granularity ?? 'day', to: 0 }
  }
  return {
    error: null,
    from: range.from,
    granularity: state.granularity ?? autoGranularity(range.from, range.to),
    to: range.to,
  }
}

function customRange(state: PeriodState) {
  const from = parse(state.custom_from, 'yyyy-MM-dd', new Date())
  const to = parse(state.custom_to, 'yyyy-MM-dd', new Date())
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return 'Choose a start and an end date.'
  }
  if (to < from) return 'The end date must be after the start date.'
  if (differenceInCalendarDays(to, from) + 1 > MAX_RANGE_DAYS) {
    return `The range cannot exceed ${MAX_RANGE_DAYS} days.`
  }
  return { from: startOfDay(from).getTime(), to: endOfDay(to).getTime() }
}

function presetRange(preset: Exclude<PeriodPreset, 'custom'>, now: Date) {
  const week = { weekStartsOn: 1 } as const
  switch (preset) {
    case 'last_3_months':
      return { from: startOfMonth(subMonths(now, 2)).getTime(), to: endOfMonth(now).getTime() }
    case 'last_4_weeks':
      return {
        from: startOfWeek(subWeeks(now, 3), week).getTime(),
        to: endOfWeek(now, week).getTime(),
      }
    case 'this_month':
      return { from: startOfMonth(now).getTime(), to: endOfMonth(now).getTime() }
    case 'this_week':
      return { from: startOfWeek(now, week).getTime(), to: endOfWeek(now, week).getTime() }
  }
}
