import { endOfDay, endOfWeek, startOfDay, startOfWeek, subWeeks } from 'date-fns'

export interface DateRange {
  from: number
  to: number
}

export type RangePreset = 'custom' | 'last_week' | 'this_week'

export const RANGE_PRESETS: { label: string; value: RangePreset }[] = [
  { label: 'This week', value: 'this_week' },
  { label: 'Last week', value: 'last_week' },
  { label: 'Custom', value: 'custom' },
]

const WEEK_OPTIONS = { weekStartsOn: 1 } as const

export function customRange(from_date: string, to_date: string): DateRange | null {
  if (!from_date || !to_date) return null
  const from = startOfDay(new Date(`${from_date}T00:00`)).getTime()
  const to = endOfDay(new Date(`${to_date}T00:00`)).getTime()
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return null
  return { from, to }
}

export function presetRange(preset: Exclude<RangePreset, 'custom'>, now = new Date()): DateRange {
  const base = preset === 'last_week' ? subWeeks(now, 1) : now
  return {
    from: startOfWeek(base, WEEK_OPTIONS).getTime(),
    to: endOfWeek(base, WEEK_OPTIONS).getTime(),
  }
}
