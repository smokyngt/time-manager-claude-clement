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

const PLACEHOLDER = /change-me|dev-only/i;
const TENANT_ALIASES = ['common', 'consumers', 'organizations'];
const LOCAL_HOSTS = ['127.0.0.1', '::1', '[::1]', 'localhost'];

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
   * @route config.proxy
   * @returns {boolean | number | string[]}
   */
  public static proxy(): boolean | number | string[] {
    const raw = Config.store.optional('TRUST_PROXY')?.trim();
    if (raw === undefined || raw === '' || raw === 'false') return false;
    if (raw === 'true') return true;
    if (/^\d+$/.test(raw)) return Number(raw);
    return raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '');
  }

  /**
   * @route config.secure
   * @param {string} value
   * @returns {boolean}
   */
  public static secure(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !LOCAL_HOSTS.includes(url.hostname);
    } catch {
      return false;
    }
  }

  /**
   * @route config.validate
   * @returns {string[]}
   */
  public static validate(): string[] {
    const problems: string[] = [];
    if (!Config.production()) return problems;
    const microsoft = Config.store.optional('MICROSOFT_CLIENT_ID') !== undefined;
    const names = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
    if (microsoft) names.push('OAUTH_STATE_SECRET');
    const seen = new Set<string>();
    for (const name of names) {
      const value = Config.store.optional(name);
      if (value === undefined || value.length < 32) {
        problems.push(`${name} must be at least 32 characters`);
        continue;
      }
      if (PLACEHOLDER.test(value)) problems.push(`${name} must not be a placeholder value`);
      if (seen.has(value)) problems.push(`${name} must differ from the other secrets`);
      seen.add(value);
    }
    if (Config.store.optional('DATABASE_URL') === undefined)
      problems.push('DATABASE_URL is required');
    if (microsoft) {
      if (Config.store.optional('MICROSOFT_CLIENT_SECRET') === undefined)
        problems.push('MICROSOFT_CLIENT_SECRET is required');
      const tenant = Config.store.text('MICROSOFT_TENANT_ID', 'common').toLowerCase();
      if (TENANT_ALIASES.includes(tenant))
        problems.push('MICROSOFT_TENANT_ID must be a single tenant id, not a multi-tenant alias');
    }
    if (!Config.store.flag('ALLOW_INSECURE_URLS', false)) {
      if (!Config.secure(Config.store.text('WEB_URL', 'http://localhost:5173')))
        problems.push('WEB_URL must be a non-local https url');
      if (
        microsoft &&
        !Config.secure(Config.store.text('MICROSOFT_REDIRECT_URI', 'http://localhost:8000'))
      )
        problems.push('MICROSOFT_REDIRECT_URI must be a non-local https url');
    }
    return problems;
  }
}
