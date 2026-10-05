import { endOfDay, endOfWeek, startOfDay, startOfWeek } from 'date-fns'

import { i18n } from '@/lib/i18n'

type Input = Date | number

function locale() {
  return i18n.resolvedLanguage ?? i18n.language
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export class Dates {
  /**
   * @route client.lib.dates.date
   * @param {Date | number} value
   * @returns {string}
   */
  static date(value: Input): string {
    return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }).format(value)
  }

  /**
   * @route client.lib.dates.dateTime
   * @param {Date | number} value
   * @returns {string}
   */
  static dateTime(value: Input): string {
    return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
      value,
    )
  }

  /**
   * @route client.lib.dates.endOfDay
   * @param {Date | number} value
   * @returns {number} Epoch milliseconds.
   */
  static endOfDay(value: Input): number {
    return endOfDay(value).getTime()
  }

  /**
   * @route client.lib.dates.endOfWeek
   * @param {Date | number} value
   * @returns {number} Epoch milliseconds, weeks start on Monday.
   */
  static endOfWeek(value: Input): number {
    return endOfWeek(value, { weekStartsOn: 1 }).getTime()
  }

  /**
   * @route client.lib.dates.fromInput
   * @param {string} value Local `YYYY-MM-DDTHH:mm` value of a datetime-local input.
   * @returns {number | null} Epoch milliseconds, null when invalid.
   */
  static fromInput(value: string): null | number {
    const time = new Date(value).getTime()
    return Number.isNaN(time) ? null : time
  }

  /**
   * @route client.lib.dates.isFuture
   * @param {Date | number} value
   * @param {number} now Epoch milliseconds.
   * @returns {boolean}
   */
  static isFuture(value: Input, now: number = Date.now()): boolean {
    return new Date(value).getTime() > now
  }

  /**
   * @route client.lib.dates.relative
   * @param {Date | number} value
   * @param {number} now Epoch milliseconds.
   * @returns {string}
   */
  static relative(value: Input, now: number = Date.now()): string {
    const seconds = Math.round((new Date(value).getTime() - now) / 1000)
    const formatter = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' })
    const steps: [Intl.RelativeTimeFormatUnit, number][] = [
      ['day', 86_400],
      ['hour', 3600],
      ['minute', 60],
    ]
    for (const [unit, size] of steps) {
      if (Math.abs(seconds) >= size) {
        return formatter.format(Math.round(seconds / size), unit)
      }
    }
    return formatter.format(seconds, 'second')
  }

  /**
   * @route client.lib.dates.startOfDay
   * @param {Date | number} value
   * @returns {number} Epoch milliseconds.
   */
  static startOfDay(value: Input): number {
    return startOfDay(value).getTime()
  }

  /**
   * @route client.lib.dates.startOfWeek
   * @param {Date | number} value
   * @returns {number} Epoch milliseconds, weeks start on Monday.
   */
  static startOfWeek(value: Input): number {
    return startOfWeek(value, { weekStartsOn: 1 }).getTime()
  }

  /**
   * @route client.lib.dates.time
   * @param {Date | number} value
   * @returns {string}
   */
  static time(value: Input): string {
    return new Intl.DateTimeFormat(locale(), { timeStyle: 'short' }).format(value)
  }

  /**
   * @route client.lib.dates.toInput
   * @param {Date | number} value
   * @returns {string} Local `YYYY-MM-DDTHH:mm` value for a datetime-local input.
   */
  static toInput(value: Input): string {
    const date = new Date(value)
    return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
}
