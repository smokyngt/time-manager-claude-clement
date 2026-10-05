import {
  AppError,
  DuplicateKeyError,
  InternalError,
  InvalidJsonError,
  NotFoundError,
  PayloadTooLargeError,
  RateLimitError, Registry, ValidationError 
} from '@/lib/errors/index.js';
import { Config } from '@/config/index.js';
import { Metrics } from '@/lib/telemetry/metrics.js';

import type { ErrorDetail, ErrorEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

type AjvIssue = {
  instancePath?: string;
  keyword: string;
  params?: Record<string, unknown>;
};

type Resolved = {
  cause: unknown;
  code: string;
  correlation_id: string | undefined;
  errors: ErrorDetail[] | undefined;
  instance: string | undefined;
  message: string;
  metadata: Record<string, unknown>;
  retry_after: number | undefined;
  status: number;
};

type Shape = {
  cause?: unknown;
  code?: unknown;
  correlation_id?: unknown;
  instance?: unknown;
  message?: unknown;
  metadata?: unknown;
  retry_after?: unknown;
  status?: unknown;
  statusCode?: unknown;
  validation?: unknown;
  validationContext?: unknown;
};

const MAX_CHAIN = 10;
const JSON_CODES = ['FST_ERR_CTP_EMPTY_JSON_BODY', 'FST_ERR_CTP_INVALID_JSON_BODY'];
const LARGE_CODES = ['FST_ERR_CTP_BODY_TOO_LARGE'];

export class ErrorHandler {
  /**
   * @route errors.handler.chain
   * @param {unknown} error
   * @returns {Record<string, unknown>[]}
   */
  public static chain(error: unknown): Record<string, unknown>[] {
    const links: Record<string, unknown>[] = [];
    let current: unknown = error;
    while (current !== undefined && current !== null && links.length < MAX_CHAIN) {
      const shape = current as Shape;
      links.push({
        code: typeof shape.code === 'string' ? shape.code : undefined,
        message: typeof shape.message === 'string' ? shape.message : '',
        name: current instanceof Error ? current.name : typeof current,
      });
      current = shape.cause;
    }

    return links;
  }

  /**
   * @route errors.handler.handle
   * @param {unknown} error
   * @param {FastifyRequest} req
   * @param {FastifyReply} reply
   * @returns {Promise<void>}
   */
  public static async handle(
    error: unknown,
    req: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const resolved = ErrorHandler.resolve(error);
    const production = Config.production();
    const body: ErrorEnvelope = {
      code: resolved.code,
      correlation_id: resolved.correlation_id ?? req.id,
      instance: resolved.instance ?? ErrorHandler.path(req.url),
      status: resolved.status,
      timestamp: Date.now(),
    };
    if (resolved.errors !== undefined) body.errors = resolved.errors;
    if (!production) {
      body.metadata = resolved.metadata;
      if (error instanceof Error && resolved.status >= 500) body.stack = error.stack;
    }
    const entry = {
      cause: ErrorHandler.chain(resolved.cause),
      code: resolved.code,
      metadata: resolved.metadata,
      status: resolved.status,
    };
    Metrics.error(resolved.code, resolved.status);
    if (resolved.status >= 500) req.log.error(entry, 'request failed');
    else req.log.warn(entry, 'request rejected');
    if (resolved.retry_after !== undefined) {
      void reply.header('Retry-After', String(resolved.retry_after));
    }
    await reply.status(resolved.status).send(body);
  }

  /**
   * @route errors.handler.missing
   * @param {FastifyRequest} req
   * @param {FastifyReply} reply
   * @returns {Promise<void>}
   */
  public static async missing(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    await ErrorHandler.handle(
      NotFoundError({ metadata: { method: req.method, route: 'error.handler.missing' } }),
      req,
      reply,
    );
  }

  private static duplicate(error: unknown): boolean {
    let current: unknown = error;
    for (
      let depth = 0;
      current !== undefined && current !== null && depth < MAX_CHAIN;
      depth += 1
    ) {
      if ((current as Shape).code === '23505') return true;
      current = (current as Shape).cause;
    }

    return false;
  }

  private static issues(issues: AjvIssue[], context: string | undefined): ErrorDetail[] {
    return issues.map((issue) => {
      const params = issue.params ?? {};
      const missing =
        typeof params['missingProperty'] === 'string' ? params['missingProperty'] : '';
      const segments = (issue.instancePath ?? '').split('/').filter((part) => part !== '');
      if (missing !== '') segments.push(missing);
      const path = [context, ...segments].filter((part) => part !== undefined).join('.');

      return {
        code: issue.keyword,
        params: Object.fromEntries(
          Object.entries(params).map(([key, value]) => [ErrorHandler.snake(key), value]),
        ),
        path,
      };
    });
  }

  private static path(url: string): string {
    const index = url.indexOf('?');

    return index === -1 ? url : url.slice(0, index);
  }

  private static resolve(error: unknown): Resolved {
    const shape = (typeof error === 'object' && error !== null ? error : {}) as Shape;
    const base = {
      cause: error,
      correlation_id: undefined,
      errors: undefined,
      instance: undefined,
      retry_after: undefined,
    };
    if (Array.isArray(shape.validation)) {
      const context =
        typeof shape.validationContext === 'string' ? shape.validationContext : undefined;

      return {
        ...base,
        code: ValidationError.code,
        errors: ErrorHandler.issues(shape.validation as AjvIssue[], context),
        message: 'Validation failed',
        metadata: {},
        status: ValidationError.defaultStatus,
      };
    }
    if (error instanceof SyntaxError || JSON_CODES.includes(String(shape.code))) {
      return {
        ...base,
        code: InvalidJsonError.code,
        message: 'Invalid JSON',
        metadata: {},
        status: InvalidJsonError.defaultStatus,
      };
    }
    if (ErrorHandler.duplicate(error)) {
      return {
        ...base,
        code: DuplicateKeyError.code,
        message: 'Duplicate key',
        metadata: {},
        status: DuplicateKeyError.defaultStatus,
      };
    }
    if (AppError.is(error)) {
      return {
        ...base,
        code: error.code,
        correlation_id: error.correlation_id,
        instance: error.instance,
        message: error.message,
        metadata: error.metadata,
        retry_after: error.retry_after,
        status: error.status,
      };
    }
    if (typeof shape.code === 'string' && Registry.has(shape.code)) {
      const status = [shape.status, shape.statusCode].find((item) => typeof item === 'number');

      return {
        ...base,
        code: shape.code,
        correlation_id: typeof shape.correlation_id === 'string' ? shape.correlation_id : undefined,
        instance: typeof shape.instance === 'string' ? shape.instance : undefined,
        message: typeof shape.message === 'string' ? shape.message : shape.code,
        metadata: {},
        retry_after: typeof shape.retry_after === 'number' ? shape.retry_after : undefined,
        status: status ?? Registry.get(shape.code)?.defaultStatus ?? InternalError.defaultStatus,
      };
    }
    if (shape.statusCode === 413 || LARGE_CODES.includes(String(shape.code))) {
      return {
        ...base,
        code: PayloadTooLargeError.code,
        message: 'Payload too large',
        metadata: {},
        status: PayloadTooLargeError.defaultStatus,
      };
    }
    if (shape.statusCode === 429) {
      return {
        ...base,
        code: RateLimitError.code,
        message: 'Rate limit exceeded',
        metadata: {},
        status: RateLimitError.defaultStatus,
      };
    }

    if (typeof shape.statusCode === 'number' && shape.statusCode >= 400 && shape.statusCode < 500) {
      return {
        ...base,
        code: ValidationError.code,
        message: error instanceof Error ? error.message : 'Bad request',
        metadata: { status_code: shape.statusCode },
        status: ValidationError.defaultStatus,
      };
    }

    return {
      ...base,
      code: InternalError.code,
      message: error instanceof Error ? error.message : 'Unexpected error',
      metadata: {},
      status: InternalError.defaultStatus,
    };
  }

  private static snake(key: string): string {
    return key.replaceAll(/([A-Z])/g, '_$1').toLowerCase();
  }
}
