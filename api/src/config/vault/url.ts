import { Env } from '@/config/env.js';

export type VaultErrorOptions = { cause?: unknown; status?: number };

export class VaultError extends Error {
  public readonly status: number | undefined;

  public constructor(message: string, options: VaultErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'VaultError';
    this.status = options.status;
  }
}

export class VaultUrl {
  /**
   * @route config.vault.url.resolve
   * @returns {string}
   * @throws {VaultError}
   */
  public static resolve(): string {
    const raw = Env.opt('VAULT_URL');
    if (raw === undefined) throw new VaultError('VAULT_URL is required');
    let url: URL;
    try {
      url = new URL(raw);
    } catch (error) {
      throw new VaultError('VAULT_URL is not a valid URL', { cause: error });
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:')
      throw new VaultError('VAULT_URL must use http or https');
    if (url.protocol === 'http:' && Env.str('NODE_ENV', 'development') === 'production')
      throw new VaultError('VAULT_URL must use https in production');

    return url.origin;
  }
}
