import { Config } from '@/config/index.js';

export type MicrosoftConfig = {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  tenant: string;
};

export class Microsoft {
  /**
   * @route microsoft.authorizeUrl
   * @param {{ challenge: string; nonce: string; state: string }} params
   * @returns {string | undefined}
   */
  public static authorizeUrl(params: {
    challenge: string;
    nonce: string;
    state: string;
  }): string | undefined {
    const config = Microsoft.config();
    if (config === undefined) return undefined;
    const query = new URLSearchParams({
      client_id: config.client_id,
      code_challenge: params.challenge,
      code_challenge_method: 'S256',
      nonce: params.nonce,
      redirect_uri: config.redirect_uri,
      response_mode: 'query',
      response_type: 'code',
      scope: 'openid profile email',
      state: params.state,
    });

    return `${Microsoft.base(config)}/authorize?${query.toString()}`;
  }

  /**
   * @route microsoft.base
   * @param {MicrosoftConfig} config
   * @returns {string}
   */
  public static base(config: MicrosoftConfig): string {
    return `https://login.microsoftonline.com/${encodeURIComponent(config.tenant)}/oauth2/v2.0`;
  }

  /**
   * @route microsoft.challenge
   * @param {string} verifier
   * @returns {string}
   */
  public static challenge(verifier: string): string {
    return new Bun.CryptoHasher('sha256').update(verifier).digest('base64url');
  }

  /**
   * @route microsoft.config
   * @returns {MicrosoftConfig | undefined}
   */
  public static config(): MicrosoftConfig | undefined {
    const clientId = Config.store.optional('MICROSOFT_CLIENT_ID');
    const clientSecret = Config.store.optional('MICROSOFT_CLIENT_SECRET');
    const tenant = Config.tenant();
    if (clientId === undefined || clientSecret === undefined || tenant === undefined) {
      return undefined;
    }

    return {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: Config.redirect(),
      tenant,
    };
  }

  /**
   * @route microsoft.random
   * @param {number} bytes
   * @returns {string}
   */
  public static random(bytes: number): string {
    return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('base64url');
  }
}
