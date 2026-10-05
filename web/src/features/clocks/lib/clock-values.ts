import type { Clock } from '@time-manager/sdk'

import type { ClockFormValues } from '@/features/clocks/lib/clock-schema'

import { Dates } from '@/lib/dates'

export type ClockEntry = {
  clockedInAt: number
  clockedOutAt: number
  note: string
  userId: string
}

export class ClockValues {
  /**
   * @route client.features.clocks.clockValues.empty
   * @param {string} userId
   * @returns {ClockFormValues}
   */
  static empty(userId: string): ClockFormValues {
    return { clockedInAt: '', clockedOutAt: '', note: '', userId }
  }

  /**
   * @route client.features.clocks.clockValues.fromClock
   * @param {Clock} clock
   * @returns {ClockFormValues}
   */
  static fromClock(clock: Clock): ClockFormValues {
    return {
      clockedInAt: Dates.toInput(clock.clockedInAt),
      clockedOutAt: clock.clockedOutAt === null ? '' : Dates.toInput(clock.clockedOutAt),
      note: clock.note ?? '',
      userId: clock.userId,
    }
  }

  /**
   * @route client.features.clocks.clockValues.toEntry
   * @param {ClockFormValues} values Validated form values.
   * @returns {ClockEntry | null} Null when a date cannot be parsed.
   */
  static toEntry(values: ClockFormValues): ClockEntry | null {
    const clockedInAt = Dates.fromInput(values.clockedInAt)
    const clockedOutAt = Dates.fromInput(values.clockedOutAt)
    if (clockedInAt === null || clockedOutAt === null) {
      return null
    }
    return { clockedInAt, clockedOutAt, note: values.note.trim(), userId: values.userId }
  }
}
