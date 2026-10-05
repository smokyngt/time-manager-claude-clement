import { Dates } from '@/lib/dates'

export type RangePreset = 'custom' | 'last_week' | 'this_week' | 'today'

export type DateRange = { from: number; to: number }

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export class ClockRange {
  static readonly presets: readonly RangePreset[] = ['today', 'this_week', 'last_week', 'custom']

  /**
   * @route client.features.clocks.clockRange.parse
   * @param {string} value
   * @returns {RangePreset} The preset, `this_week` when unknown.
   */
  static parse(value: string): RangePreset {
    return ClockRange.presets.find((preset) => preset === value) ?? 'this_week'
  }

  /**
   * @route client.features.clocks.clockRange.resolve
   * @param {RangePreset} preset
   * @param {string} from `YYYY-MM-DD`, used by the custom preset.
   * @param {string} to `YYYY-MM-DD`, used by the custom preset.
   * @param {number} now Epoch milliseconds.
   * @returns {DateRange | null} Null when a custom range is incomplete or reversed.
   */
  static resolve(preset: RangePreset, from: string, to: string, now: number): DateRange | null {
    if (preset === 'today') {
      return { from: Dates.startOfDay(now), to: Dates.endOfDay(now) }
    }
    if (preset === 'this_week') {
      return { from: Dates.startOfWeek(now), to: Dates.endOfWeek(now) }
    }
    if (preset === 'last_week') {
      return { from: Dates.startOfWeek(now - WEEK_MS), to: Dates.endOfWeek(now - WEEK_MS) }
    }
    const start = Dates.fromInput(`${from}T00:00`)
    const end = Dates.fromInput(`${to}T00:00`)
    if (start === null || end === null || end < start) {
      return null
    }
    return { from: Dates.startOfDay(start), to: Dates.endOfDay(end) }
  }
}
