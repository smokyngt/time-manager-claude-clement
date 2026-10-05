import FastifyOtel from '@fastify/otel';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';

import { Config } from '@/config/index.js';

import type { Span } from '@opentelemetry/api';

const NAME = 'time-manager-api';

let sdk: NodeSDK | null = null;

export class Tracing {
  /**
   * @route tracing.enabled
   * @returns {boolean}
   */
  public static enabled(): boolean {
    return Config.store.optional('OTEL_EXPORTER_OTLP_ENDPOINT') !== undefined;
  }

  /**
   * @route tracing.span
   * @param {string} name
   * @param {(span: Span) => Promise<Result>} fn
   * @returns {Promise<Result>}
   * @throws {Error}
   */
  public static async span<Result>(
    name: string,
    fn: (span: Span) => Promise<Result>,
  ): Promise<Result> {
    return trace.getTracer(NAME).startActiveSpan(name, async (span) => {
      try {
        return await fn(span);
      } catch (error) {
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * @route tracing.start
   * @returns {boolean}
   */
  public static start(): boolean {
    const endpoint = Config.store.optional('OTEL_EXPORTER_OTLP_ENDPOINT');
    if (endpoint === undefined || sdk !== null) return false;
    const started = new NodeSDK({
      instrumentations: [
        new HttpInstrumentation(),
        new UndiciInstrumentation(),
        new FastifyOtel.FastifyOtelInstrumentation({
          ignorePaths: '/health',
          registerOnInitialization: true,
        }),
      ],
      resource: resourceFromAttributes({
        'deployment.environment.name': Config.store.text('NODE_ENV', 'development'),
        'service.name': Config.store.text('OTEL_SERVICE_NAME', NAME),
        'service.version': Config.store.text('APP_VERSION', '0.1.0'),
      }),
      traceExporter: new OTLPTraceExporter({ url: `${endpoint.replace(/\/+$/, '')}/v1/traces` }),
    });
    started.start();
    sdk = started;

    return true;
  }

  /**
   * @route tracing.stop
   * @returns {Promise<void>}
   */
  public static async stop(): Promise<void> {
    const current = sdk;
    if (current === null) return;
    sdk = null;
    await current.shutdown();
  }
}
