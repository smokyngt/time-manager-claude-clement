export class Env {
  /**
   * @route config.env.bool
   * @param {string} name
   * @param {boolean} fallback
   * @returns {boolean}
   * @throws {Error}
   */
  public static bool(name: string, fallback: boolean): boolean {
    const raw = Env.opt(name)?.toLowerCase();
    if (raw === undefined) return fallback;
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;

    throw new Error(`${name} must be a boolean`);
  }

  /**
   * @route config.env.int
   * @param {string} name
   * @param {number} fallback
   * @returns {number}
   * @throws {Error}
   */
  public static int(name: string, fallback: number): number {
    const raw = Env.opt(name);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);

    return value;
  }

  /**
   * @route config.env.list
   * @param {string} name
   * @param {string[]} fallback
   * @returns {string[]}
   */
  public static list(name: string, fallback: string[] = []): string[] {
    const raw = Env.opt(name);
    if (raw === undefined) return fallback;

    return raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '');
  }

  /**
   * @route config.env.opt
   * @param {string} name
   * @returns {string | undefined}
   */
  public static opt(name: string): string | undefined {
    const raw = process.env[name]?.trim();

    return raw === undefined || raw === '' ? undefined : raw;
  }

  /**
   * @route config.env.str
   * @param {string} name
   * @param {string} fallback
   * @returns {string}
   */
  public static str(name: string, fallback: string): string {
    return Env.opt(name) ?? fallback;
  }
}
