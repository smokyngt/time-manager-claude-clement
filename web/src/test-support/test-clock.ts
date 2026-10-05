import { vi } from 'vitest'

export class TestClock {
  /**
   * @route client.testSupport.testClock.advance
   * @param {number} ms
   * @returns {Promise<void>}
   */
  static async advance(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms)
  }

  /**
   * @route client.testSupport.testClock.install
   * @param {Date | number | string} now Frozen system time.
   * @returns {void}
   */
  static install(now: Date | number | string = '2026-01-05T09:00:00.000Z'): void {
    vi.useFakeTimers({
      toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    vi.setSystemTime(new Date(now))
  }

  /**
   * @route client.testSupport.testClock.restore
   * @returns {void}
   */
  static restore(): void {
    vi.useRealTimers()
  }
}
