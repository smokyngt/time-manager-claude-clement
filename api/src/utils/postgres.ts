export class Postgres {
  /**
   * @route postgres.conflict
   * @param {unknown} error
   * @returns {boolean}
   */
  public static conflict(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    if ('code' in error && error.code === '23505') return true;

    return 'cause' in error && error.cause !== undefined && Postgres.conflict(error.cause);
  }
}
