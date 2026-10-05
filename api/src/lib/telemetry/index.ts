import { trace } from '@opentelemetry/api';

import { Config } from '@/config/index.js';

import type { IncomingMessage } from 'node:http';

export type LoggerOptions = {
  level: string;
  mixin: () => TraceFields;
  redact: { censor: string; paths: string[] };
  transport?: { options: { colorize: boolean; translateTime: string }; target: string };
};

export type TraceFields = { span_id?: string; trace_id?: string };

const REQUEST_ID_PATTERN = /^[\w-]{1,128}$/;

export class Telemetry {
  public static readonly redacted: readonly string[] = [
    '*.access_token',
    '*.current_password',
    '*.password',
    '*.refresh_token',
    'req.headers.authorization',
    'req.headers.cookie',
    'res.headers["set-cookie"]',
  ];

  /**
   * @route telemetry.id
   * @param {Pick<IncomingMessage, 'headers'>} req
   * @returns {string}
   */
  public static id(req: Pick<IncomingMessage, 'headers'>): string {
    const incoming = req.headers['x-request-id'];
    if (typeof incoming === 'string' && Telemetry.valid(incoming)) return incoming;

    return crypto.randomUUID();
  }

  /**
   * @route telemetry.logger
   * @returns {LoggerOptions}
   */
  public static logger(): LoggerOptions {
    const options: LoggerOptions = {
      level: Config.store.text('LOG_LEVEL', 'info'),
      mixin: () => Telemetry.trace(),
      redact: { censor: '[redacted]', paths: [...Telemetry.redacted] },
    };
    if (Config.store.text('NODE_ENV', 'development') === 'development') {
      options.transport = {
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
        target: 'pino-pretty',
      };
    }

    return options;
  }

  /**
   * @route telemetry.trace
   * @returns {TraceFields}
   */
  public static trace(): TraceFields {
    const context = trace.getActiveSpan()?.spanContext();
    if (context === undefined || !trace.isSpanContextValid(context)) return {};

    return { span_id: context.spanId, trace_id: context.traceId };
  }

  /**
   * @route telemetry.valid
   * @param {string} value
   * @returns {boolean}
   */
  public static valid(value: string): boolean {
    return REQUEST_ID_PATTERN.test(value);
  }
}
