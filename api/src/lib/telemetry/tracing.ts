import FastifyOtel from '@fastify/otel';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';

import { Config } from '@/config/index.js';

export class Tracing {
  private static sdk: NodeSDK | null = null;

  /**
   * @route tracing.enabled
   * @returns {boolean}
   */
  public static enabled(): boolean {
    return Config.store.optional('OTEL_EXPORTER_OTLP_ENDPOINT') !== undefined;
  }

  /**
   * @route tracing.start
   * @returns {boolean}
   */
  public static start(): boolean {
    if (!Tracing.enabled() || Tracing.sdk !== null) return false;
    const sdk = new NodeSDK({
      instrumentations: [new HttpInstrumentation(), new FastifyOtel.FastifyOtelInstrumentation({ ignorePaths: '/health', registerOnInitialization: true })],
      resource: resourceFromAttributes({
        'deployment.environment.name': Config.store.text('NODE_ENV', 'development'),
        'service.name': Config.store.text('OTEL_SERVICE_NAME', 'time-manager-api'),
        'service.version': Config.store.text('APP_VERSION', '0.1.0'),
      }),
      traceExporter: new OTLPTraceExporter(),
    });
    sdk.start();
    Tracing.sdk = sdk;
    return true;
  }

  /**
   * @route tracing.stop
   * @returns {Promise<void>}
   */
  public static async stop(): Promise<void> {
    const sdk = Tracing.sdk;
    if (sdk === null) return;
    Tracing.sdk = null;
    await sdk.shutdown();
  }
}
