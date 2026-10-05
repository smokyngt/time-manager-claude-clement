import { trace } from '@opentelemetry/api';
import { createHash, timingSafeEqual } from 'node:crypto';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

import type { OpenMetricsContentType, RegistryContentType } from 'prom-client';

export type MetricsBinding = {
  openClocks?: () => Promise<number>;
  poolMax?: number;
};

export type MetricsGate = 'allow' | 'deny' | 'hide';

export type MetricsGateParams = {
  header: string | undefined;
  production: boolean;
  token: string | undefined;
};

export type MetricsObservation = {
  method: string;
  route: string;
  seconds: number;
  status: number;
  trace?: string;
};

export type MetricsScrape = { body: string; type: string };

const OPENMETRICS = 'application/openmetrics-text';

type Instruments = {
  duration: Histogram;
  errors: Counter;
  events: Counter;
  registry: Registry<RegistryContentType>;
};

const binding: MetricsBinding = {};

const build = (registry: Registry<RegistryContentType>, exemplars: boolean): Instruments => {
  collectDefaultMetrics({ prefix: 'tm_', register: registry });
  new Gauge({
    async collect() {
      if (binding.openClocks === undefined) {
        this.set(0);

        return;
      }
      try {
        this.set(await binding.openClocks());
      } catch {
        this.set(Number.NaN);
      }
    },
    help: 'Clocks currently open (clocked in, not yet out).',
    name: 'tm_open_clocks',
    registers: [registry],
  });
  new Gauge({
    collect() {
      if (binding.poolMax !== undefined) this.set(binding.poolMax);
    },
    help: 'Configured maximum size of the database connection pool.',
    name: 'tm_db_pool_max_connections',
    registers: [registry],
  });

  return {
    duration: new Histogram({
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      enableExemplars: exemplars,
      help: 'HTTP request duration in seconds.',
      labelNames: ['method', 'route', 'status_code'],
      name: 'http_request_duration_seconds',
      registers: [registry],
    }),
    errors: new Counter({
      help: 'Errors returned to clients, by code and status.',
      labelNames: ['code', 'status'],
      name: 'tm_errors_total',
      registers: [registry],
    }),
    events: new Counter({
      help: 'Business events emitted, by code.',
      labelNames: ['code'],
      name: 'tm_events_total',
      registers: [registry],
    }),
    registry,
  };
};

const openRegistry = new Registry<OpenMetricsContentType>();
openRegistry.setContentType(Registry.OPENMETRICS_CONTENT_TYPE);

const open = build(openRegistry, true);
const plain = build(new Registry(), false);
const both = [open, plain];

export class Metrics {
  /**
   * @route metrics.bind
   * @param {MetricsBinding} sources
   * @returns {void}
   */
  public static bind(sources: MetricsBinding): void {
    Object.assign(binding, sources);
  }

  /**
   * @route metrics.digest
   * @param {string} value
   * @returns {Buffer}
   */
  public static digest(value: string): Buffer {
    return createHash('sha256').update(value).digest();
  }

  /**
   * @route metrics.error
   * @param {string} code
   * @param {number} status
   * @returns {void}
   */
  public static error(code: string, status: number): void {
    for (const set of both) set.errors.inc({ code, status: String(status) });
  }

  /**
   * @route metrics.event
   * @param {string} code
   * @returns {void}
   */
  public static event(code: string): void {
    for (const set of both) set.events.inc({ code });
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
   * @route metrics.observe
   * @param {MetricsObservation} observation
   * @returns {void}
   */
  public static observe(observation: MetricsObservation): void {
    const labels = {
      method: observation.method,
      route: observation.route,
      status_code: String(observation.status),
    };
    open.duration.observe({
      exemplarLabels: observation.trace === undefined ? {} : { trace_id: observation.trace },
      labels,
      value: observation.seconds,
    });
    plain.duration.observe(labels, observation.seconds);
  }

  /**
   * @route metrics.reset
   * @returns {void}
   */
  public static reset(): void {
    for (const set of both) set.registry.resetMetrics();
    binding.openClocks = undefined;
    binding.poolMax = undefined;
  }

  /**
   * @route metrics.route
   * @param {string | undefined} url
   * @returns {string}
   */
  public static route(url: string | undefined): string {
    return url ?? 'unmatched';
  }

  /**
   * @route metrics.scrape
   * @param {string | undefined} accept
   * @returns {Promise<MetricsScrape>}
   */
  public static async scrape(accept: string | undefined): Promise<MetricsScrape> {
    const { registry } = accept?.includes(OPENMETRICS) === true ? open : plain;

    return { body: await registry.metrics(), type: registry.contentType };
  }

  /**
   * @route metrics.trace
   * @returns {string | undefined}
   */
  public static trace(): string | undefined {
    const context = trace.getActiveSpan()?.spanContext();

    return context !== undefined && trace.isSpanContextValid(context) ? context.traceId : undefined;
  }
}
