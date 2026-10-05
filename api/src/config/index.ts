import { isIP } from 'node:net';

import { Keys } from '@/utils/crypto/keys.js';

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

const PLACEHOLDER = /change[-_]?me|dev[-_]?only/i;
const TENANT_GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCAL_HOSTS = ['127.0.0.1', '::1', '[::1]', 'localhost'];

export class Config {
  public static readonly store = new ConfigStore();

  /**
   * @route config.address
   * @param {string} entry
   * @returns {boolean}
   */
  public static address(entry: string): boolean {
    const [host = '', prefix, ...rest] = entry.split('/');
    if (rest.length > 0 || isIP(host) === 0) return false;
    if (prefix === undefined) return true;
    const limit = isIP(host) === 4 ? 32 : 128;

    return /^\d{1,3}$/.test(prefix) && Number(prefix) <= limit;
  }

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
   * @route config.redirect
   * @returns {string}
   */
  public static redirect(): string {
    return Config.store.text(
      'MICROSOFT_REDIRECT_URI',
      'http://localhost:8000/v1/auth/microsoft/callback',
    );
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
   * @route config.web
   * @returns {string}
   */
  public static web(): string {
    return Config.store.text('WEB_URL', 'http://localhost:5173').replace(/\/+$/, '');
  }

  /**
   * @route config.tenant
   * @returns {string | undefined}
   */
  public static tenant(): string | undefined {
    const raw = Config.store.optional('MICROSOFT_TENANT_ID')?.trim().toLowerCase();

    return raw !== undefined && TENANT_GUID.test(raw) ? raw : undefined;
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
      const clientSecret = Config.store.optional('MICROSOFT_CLIENT_SECRET');
      if (clientSecret === undefined) problems.push('MICROSOFT_CLIENT_SECRET is required');
      else if (PLACEHOLDER.test(clientSecret))
        problems.push('MICROSOFT_CLIENT_SECRET must not be a placeholder value');
      if (Config.tenant() === undefined)
        problems.push(
          'MICROSOFT_TENANT_ID must be a single tenant id (GUID), not common, organizations or consumers',
        );
    }
    if (!Config.store.flag('ALLOW_INSECURE_URLS', false)) {
      if (!Config.secure(Config.web())) problems.push('WEB_URL must be a non-local https url');
      if (microsoft && !Config.secure(Config.redirect()))
        problems.push('MICROSOFT_REDIRECT_URI must be a non-local https url');
    }
    const proxy = Config.proxy();
    if (Array.isArray(proxy) && !proxy.every((entry) => Config.address(entry)))
      problems.push('TRUST_PROXY must be true, false, a hop count or a list of IPs and CIDR ranges');
    problems.push(...Keys.validate());

    return problems;
  }
}
