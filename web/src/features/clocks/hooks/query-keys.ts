import type { ClockListBody } from '@/features/clocks/api/types'

export const CLOCKS_QUERY_KEY = ['clocks'] as const
export const CURRENT_CLOCK_QUERY_KEY = ['clocks', 'current'] as const
export const REPORTS_QUERY_KEY = ['reports'] as const

export type ClockFilters = Omit<ClockListBody, 'cursor'>

export function clockListKey(filters: ClockFilters) {
  return ['clocks', 'list', filters] as const
}
