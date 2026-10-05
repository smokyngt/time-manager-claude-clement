export type Probe = () => Promise<unknown>;

export class Health {
  /**
   * @route health.check
   * @param {Probe} probe
   * @param {number} timeout
   * @returns {Promise<boolean>}
   */
  public static async check(probe: Probe, timeout: number): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<false>((resolve) => {
      timer = setTimeout(() => {
        resolve(false);
      }, timeout);
    });
    const attempt = probe().then(
      () => true,
      () => false,
    );
    try {
      return await Promise.race([attempt, expired]);
    } finally {
      clearTimeout(timer);
    }
  }
}
