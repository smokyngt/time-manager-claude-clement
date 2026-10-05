const UNITS: Record<string, number> = { d: 86_400, h: 3_600, m: 60, s: 1 };

export class Duration {
  /**
   * @route duration.seconds
   * @param {string} value
   * @param {number} fallback
   * @returns {number}
   */
  public static seconds(value: string, fallback: number): number {
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (match === null) return fallback;
    const [, amount, unit] = match;
    const multiplier = UNITS[unit ?? 's'] ?? 1;
    return Number(amount) * multiplier;
  }
}
