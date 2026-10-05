export class Postgres {
  /**
   * @route postgres.conflict
   * @param {unknown} error
   * @returns {boolean}
   */
  public static conflict(error: unknown): boolean {
    const candidate = error as null | { cause?: unknown; code?: unknown };
    if (candidate === null || typeof candidate !== 'object') return false;
    if (candidate.code === '23505') return true;
    return candidate.cause !== undefined && Postgres.conflict(candidate.cause);
  }
}
