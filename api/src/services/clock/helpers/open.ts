type Shape = {
  cause?: unknown;
  code?: unknown;
  constraint?: unknown;
  constraint_name?: unknown;
};

const MAX_CHAIN = 10;

export class OpenClock {
  public static readonly index = 'clocks_user_id_open_idx';

  /**
   * @route clock.service.open.violated
   * @param {unknown} error
   * @returns {boolean}
   */
  public static violated(error: unknown): boolean {
    let current: unknown = error;
    for (let depth = 0; current !== undefined && current !== null && depth < MAX_CHAIN; depth += 1) {
      const shape = current as Shape;
      if (shape.code === '23505') {
        return shape.constraint_name === OpenClock.index || shape.constraint === OpenClock.index;
      }
      current = shape.cause;
    }

    return false;
  }
}
