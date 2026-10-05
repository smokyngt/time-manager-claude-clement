const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const WORKDAYS_PER_WEEK = 5;

export class Kpi {
  public static readonly defaultStart = '09:00';
  public static readonly defaultWeeklyHours = 35;
  public static readonly graceMinutes = 5;
  public static readonly maxDays = 366;

  /**
   * @route kpi.average
   * @param {number} total
   * @param {number} count
   * @returns {number}
   */
  public static average(total: number, count: number): number {
    if (count <= 0) return 0;

    return Math.round(total / count);
  }

  /**
   * @route kpi.overtime
   * @param {number} worked
   * @param {number} target
   * @returns {number}
   */
  public static overtime(worked: number, target: number): number {
    return worked - target;
  }

  /**
   * @route kpi.rate
   * @param {number} part
   * @param {number} whole
   * @returns {number}
   */
  public static rate(part: number, whole: number): number {
    if (whole <= 0 || part <= 0) return 0;

    return Math.round(Math.min(part / whole, 1) * 10_000) / 10_000;
  }

  /**
   * @route kpi.target
   * @param {number} weeklyHours
   * @param {number} workdays
   * @returns {number}
   */
  public static target(weeklyHours: number, workdays: number): number {
    if (weeklyHours <= 0 || workdays <= 0) return 0;

    return Math.round((weeklyHours * HOUR_MS * workdays) / WORKDAYS_PER_WEEK);
  }

  /**
   * @route kpi.valid
   * @param {number} from
   * @param {number} to
   * @returns {boolean}
   */
  public static valid(from: number, to: number): boolean {
    return (
      Number.isFinite(from) && Number.isFinite(to) && to > from && to - from <= Kpi.maxDays * DAY_MS
    );
  }
}
