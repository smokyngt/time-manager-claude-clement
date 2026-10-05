export class Time {
  /**
   * @route time.bound
   * @param {number | string | undefined} value
   * @returns {number | undefined}
   */
  public static bound(value: number | string | undefined): number | undefined {
    if (value === undefined) return undefined;
    if (typeof value === 'number') return value;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
}
