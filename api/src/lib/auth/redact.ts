const SENSITIVE = ['code', 'error_description', 'session_state', 'state'];

export class Redact {
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

    return `${url.slice(0, index)}?${query.toString().replaceAll('%5Bredacted%5D', 'redacted')}`;
  }
}
