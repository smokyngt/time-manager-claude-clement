import type { VaultConfig } from '@/config/vault/index.js';

const MAX_DELAY = 2_147_483_647;
const RETRY_DELAY = 30_000;

export type VaultRelogin = () => Promise<number>;

export class VaultToken {
  private base = 0;
  private readonly config: VaultConfig;
  private relogin: undefined | VaultRelogin;
  private timer: ReturnType<typeof setTimeout> | undefined;

  public constructor(config: VaultConfig) {
    this.config = config;
  }

  /**
   * @route config.vault.token.active
   * @returns {boolean}
   */
  public active(): boolean {
    return this.timer !== undefined;
  }

  /**
   * @route config.vault.token.login
   * @param {VaultRelogin} handler
   * @returns {void}
   */
  public login(handler: VaultRelogin): void {
    this.relogin = handler;
  }

  /**
   * @route config.vault.token.schedule
   * @param {number} ttl
   * @returns {void}
   */
  public schedule(ttl: number): void {
    this.stop();
    if (!Number.isFinite(ttl) || ttl <= 0) return;
    this.base = ttl;
    this.arm(Math.floor(ttl * 1000 * this.config.threshold()));
  }

  /**
   * @route config.vault.token.stop
   * @returns {void}
   */
  public stop(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private arm(delay: number): void {
    this.timer = setTimeout(() => {
      void this.renew();
    }, Math.min(Math.max(delay, 0), MAX_DELAY));
    this.timer.unref();
  }

  private async renew(): Promise<void> {
    this.timer = undefined;
    try {
      const reply = await this.config.client.tokenRenewSelf();
      const ttl = reply.auth?.lease_duration ?? 0;
      if (this.relogin !== undefined && (reply.auth?.renewable === false || ttl < this.base)) {
        await this.reauthenticate();

        return;
      }
      this.config.log.info('[VAULT] token renewed');
      this.arm(Math.floor(ttl * 1000 * this.config.threshold()));
    } catch (error) {
      if (this.relogin !== undefined) {
        await this.reauthenticate();

        return;
      }
      this.config.log.warn(
        `[VAULT] token renewal failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      this.arm(RETRY_DELAY);
    }
  }

  private async reauthenticate(): Promise<void> {
    try {
      const ttl = await (this.relogin as VaultRelogin)();
      this.config.log.info('[VAULT] token re-login succeeded');
      this.schedule(ttl);
    } catch (error) {
      this.config.log.warn(
        `[VAULT] token re-login failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      this.arm(RETRY_DELAY);
    }
  }
}
