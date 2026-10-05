class ConfigStore {
  /**
   * @route config.store.flag
   * @param {string} name
   * @param {boolean} fallback
   * @returns {boolean}
   */
  public flag(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    return raw === 'true' || raw === '1';
  }

  /**
   * @route config.store.number
   * @param {string} name
   * @param {number} fallback
   * @returns {number}
   */
  public number(name: string, fallback: number): number {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }

  /**
   * @route config.store.optional
   * @param {string} name
   * @returns {string | undefined}
   */
  public optional(name: string): string | undefined {
    const raw = process.env[name];
    return raw === undefined || raw === '' ? undefined : raw;
  }

  /**
   * @route config.store.text
   * @param {string} name
   * @param {string} fallback
   * @returns {string}
   */
  public text(name: string, fallback: string): string {
    const raw = process.env[name];
    return raw === undefined || raw === '' ? fallback : raw;
  }
}

export class Config {
  public static readonly store = new ConfigStore();

  /**
   * @route config.production
   * @returns {boolean}
   */
  public static production(): boolean {
    return Config.store.text('NODE_ENV', 'development') === 'production';
  }

  /**
   * @route config.validate
   * @returns {string[]}
   */
  public static validate(): string[] {
    const problems: string[] = [];
    if (!Config.production()) return problems;
    for (const name of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
      const value = Config.store.optional(name);
      if (value === undefined || value.length < 32)
        problems.push(`${name} must be at least 32 characters`);
    }
    if (Config.store.optional('DATABASE_URL') === undefined)
      problems.push('DATABASE_URL is required');
    return problems;
  }
}
