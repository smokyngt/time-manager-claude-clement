import { ValidationError } from '@/lib/errors/index.js';

const UNITS: Record<string, number> = { d: 86_400, h: 3_600, m: 60, s: 1 };

export class Time {
  public static readonly day = 86_400_000;
  public static readonly hour = 3_600_000;

  /**
   * @route time.bound
   * @param {number | string | undefined} value
   * @returns {number | undefined}
   * @throws {ValidationError}
   */
  public static bound(value: number | string | undefined): number | undefined {
    if (value === undefined) return undefined;
    if (typeof value === 'number') return value;
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      throw ValidationError({ metadata: { reason: 'invalid_date', route: 'time.bound' } });
    }

    return parsed;
  }

  /**
   * @route time.seconds
   * @param {string} value
   * @returns {number}
   * @throws {ValidationError}
   */
  public static seconds(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    const multiplier = UNITS[match?.[2] ?? ''];
    if (match === null || multiplier === undefined) {
      throw ValidationError({ metadata: { reason: 'invalid_duration', route: 'time.seconds' } });
    }

    return Number(match[1]) * multiplier;
  }
}
