import type { Granularity } from '@time-manager/sdk'

import { Dates } from '@/lib/dates'

export type GranularityChoice = 'auto' | Granularity

export type PeriodError = 'range_order' | 'range_required' | 'range_too_long'

export type PeriodPreset = 'custom' | 'last_3_months' | 'last_4_weeks' | 'this_month' | 'this_week'

export type PeriodState = {
  from: string
  granularity: GranularityChoice
  preset: PeriodPreset
  to: string
}

export type ResolvedPeriod = {
  error: null | PeriodError
  from: number
  granularity: Granularity
  to: number
}

export const MAX_RANGE_DAYS = 366

const DAY_MS = 86_400_000

export const PERIOD_PRESETS: readonly PeriodPreset[] = [
  'this_week',
  'last_4_weeks',
  'this_month',
  'last_3_months',
  'custom',
]

export const GRANULARITIES: readonly Granularity[] = ['day', 'week', 'month']

export const DEFAULT_PERIOD_STATE: PeriodState = {
  from: '',
  granularity: 'auto',
  preset: 'this_week',
  to: '',
}

export function isGranularity(value: string): value is Granularity {
  return GRANULARITIES.some((granularity) => granularity === value)
}

export function isGranularityChoice(value: string): value is GranularityChoice {
  return value === 'auto' || isGranularity(value)
}

export function isPreset(value: string): value is PeriodPreset {
  return PERIOD_PRESETS.some((preset) => preset === value)
}

export function calendarDays(from: number, to: number) {
  return Math.round((Dates.startOfDay(to) - Dates.startOfDay(from)) / DAY_MS) + 1
}

export function autoGranularity(from: number, to: number): Granularity {
  const days = calendarDays(from, to)
  if (days <= 31) {
    return 'day'
  }
  if (days <= 130) {
    return 'week'
  }
  return 'month'
}

export function resolvePeriod(state: PeriodState, now: Date): ResolvedPeriod {
  const range = state.preset === 'custom' ? customRange(state) : presetRange(state.preset, now)
  const chosen = state.granularity === 'auto' ? null : state.granularity
  if (typeof range === 'string') {
    return { error: range, from: 0, granularity: chosen ?? 'day', to: 0 }
  }
  return {
    error: null,
    from: range.from,
    granularity: chosen ?? autoGranularity(range.from, range.to),
    to: range.to,
  }
}

export function isComplete(period: Pick<ResolvedPeriod, 'to'>, now: number) {
  return period.to <= now
}

function customRange(state: PeriodState) {
  const from = Dates.fromInput(`${state.from}T00:00`)
  const to = Dates.fromInput(`${state.to}T00:00`)
  if (from === null || to === null) {
    return 'range_required'
  }
  if (to < from) {
    return 'range_order'
  }
  if (calendarDays(from, to) > MAX_RANGE_DAYS) {
    return 'range_too_long'
  }
  return { from: Dates.startOfDay(from), to: Dates.endOfDay(to) }
}

function endOfMonth(year: number, month: number) {
  return new Date(year, month + 1, 0, 23, 59, 59, 999).getTime()
}

function presetRange(preset: Exclude<PeriodPreset, 'custom'>, now: Date) {
  const year = now.getFullYear()
  const month = now.getMonth()
  switch (preset) {
    case 'last_3_months':
      return { from: new Date(year, month - 2, 1).getTime(), to: endOfMonth(year, month) }
    case 'last_4_weeks':
      return {
        from: Dates.startOfWeek(new Date(year, month, now.getDate() - 21)),
        to: Dates.endOfWeek(now),
      }
    case 'this_month':
      return { from: new Date(year, month, 1).getTime(), to: endOfMonth(year, month) }
    case 'this_week':
      return { from: Dates.startOfWeek(now), to: Dates.endOfWeek(now) }
  }
}
