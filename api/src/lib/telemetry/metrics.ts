import { createHash, timingSafeEqual } from 'node:crypto';

export type MetricsGate = 'allow' | 'deny' | 'hide';

export interface MetricsGateParams {
  header: string | undefined;
  production: boolean;
  token: string | undefined;
}

export class Metrics {
  public static readonly buckets: readonly number[] = [
    0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
  ];

  /**
   * @route metrics.digest
   * @param {string} value
   * @returns {Buffer}
   */
  public static digest(value: string): Buffer {
    return createHash('sha256').update(value).digest();
  }

  /**
   * @route metrics.gate
   * @param {MetricsGateParams} params
   * @returns {MetricsGate}
   */
  public static gate(params: MetricsGateParams): MetricsGate {
    if (params.token === undefined) return params.production ? 'hide' : 'allow';
    if (params.header?.startsWith('Bearer ') !== true) return 'deny';
    const given = Metrics.digest(params.header.slice(7));
    return timingSafeEqual(given, Metrics.digest(params.token)) ? 'allow' : 'deny';
  }

  /**
   * @route metrics.route
   * @param {string | undefined} url
   * @returns {string}
   */
  public static route(url: string | undefined): string {
    return url ?? 'unmatched';
  }
}
