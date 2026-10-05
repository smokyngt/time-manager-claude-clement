const SENSITIVE = ['code', 'error_description', 'session_state', 'state'];

export type RedactedRequest = {
  host: string | undefined;
  method: string;
  remoteAddress: string | undefined;
  remotePort: number | undefined;
  url: string | undefined;
};

export type RedactInput = {
  hostname?: string;
  ip?: string;
  method: string;
  socket?: { remotePort?: number };
  url?: string;
};

export class Redact {
  /**
   * @route redact.request
   * @param {RedactInput} req
   * @returns {RedactedRequest}
   */
  public static request(req: RedactInput): RedactedRequest {
    return {
      host: req.hostname,
      method: req.method,
      remoteAddress: req.ip,
      remotePort: req.socket?.remotePort,
      url: Redact.url(req.url),
    };
  }

  /**
   * @route redact.url
   * @param {string | undefined} url
   * @returns {string | undefined}
   */
  public static url(url: string | undefined): string | undefined {
    if (url === undefined) return undefined;
    const index = url.indexOf('?');
    if (index === -1) return url;
    const query = new URLSearchParams(url.slice(index + 1));
    for (const name of SENSITIVE) {
      if (query.has(name)) query.set(name, 'redacted');
    }

    return `${url.slice(0, index)}?${query.toString()}`;
  }
}
