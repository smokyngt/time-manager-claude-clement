import type { VaultConfig } from '@/config/vault/index.js';

const MAX_DELAY = 2_147_483_647;
const RETRY_DELAY = 30_000;

export class VaultToken {
  private readonly config: VaultConfig;
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
   * @route config.vault.token.schedule
   * @param {number} ttl
   * @returns {void}
   */
  public schedule(ttl: number): void {
    this.stop();
    if (!Number.isFinite(ttl) || ttl <= 0) return;
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
      this.config.log.info('[VAULT] token renewed');
      this.schedule(ttl);
    } catch (error) {
      this.config.log.warn(
        `[VAULT] token renewal failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      this.arm(RETRY_DELAY);
    }
  }
}
