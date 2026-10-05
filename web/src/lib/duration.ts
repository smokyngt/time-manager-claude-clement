const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export class Duration {
  /**
   * @route client.lib.duration.elapsed
   * @param {number} since Epoch milliseconds.
   * @param {number} now Epoch milliseconds.
   * @returns {number}
   */
  static elapsed(since: number, now: number): number {
    return Math.max(0, now - since)
  }

  /**
   * @route client.lib.duration.format
   * @param {number} ms
   * @returns {string} HH:MM:SS
   */
  static format(ms: number): string {
    const total = Math.floor(Math.max(0, ms) / SECOND)
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    return `${pad(hours)}:${pad(minutes)}:${pad(total % 60)}`
  }

  /**
   * @route client.lib.duration.fromHours
   * @param {number} hours
   * @returns {number}
   */
  static fromHours(hours: number): number {
    return Math.round(hours * HOUR)
  }

  /**
   * @route client.lib.duration.short
   * @param {number} ms
   * @returns {string} For example 8h 05m or 42m.
   */
  static short(ms: number): string {
    const total_minutes = Math.floor(Math.max(0, ms) / MINUTE)
    const hours = Math.floor(total_minutes / 60)
    const minutes = total_minutes % 60
    if (hours === 0) {
      return `${String(minutes)}m`
    }
    return `${String(hours)}h ${pad(minutes)}m`
  }

  /**
   * @route client.lib.duration.toHours
   * @param {number} ms
   * @param {number} digits
   * @returns {number}
   */
  static toHours(ms: number, digits = 1): number {
    const factor = 10 ** digits
    return Math.round((ms / HOUR) * factor) / factor
  }
}
