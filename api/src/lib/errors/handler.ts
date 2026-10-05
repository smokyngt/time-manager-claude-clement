import {
  AppError,
  InternalError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from './index.js';

import type { ErrorEnvelope } from '@/types/envelope.js';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export class ErrorHandler {
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
    const app = ErrorHandler.normalize(error);
    if (app.status >= 500) {
      req.log.error({ code: app.code, err: error, metadata: app.metadata }, 'request failed');
    } else {
      req.log.warn(
        { code: app.code, metadata: app.metadata, status: app.status },
        'request rejected',
      );
    }
    const body: ErrorEnvelope = {
      code: app.code,
      message: app.message,
      request_id: req.id,
      status: app.status,
    };
    await reply.status(app.status).send(body);
  }

  /**
   * @route errors.handler.missing
   * @param {FastifyRequest} req
   * @param {FastifyReply} reply
   * @returns {Promise<void>}
   */
  public static async missing(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    await ErrorHandler.handle(NotFoundError(), req, reply);
  }

  /**
   * @route errors.handler.normalize
   * @param {unknown} error
   * @returns {AppError}
   */
  public static normalize(error: unknown): AppError {
    if (AppError.is(error)) return error;
    const fastify = error as null | Partial<FastifyError>;
    if (fastify?.validation !== undefined) {
      return ValidationError({
        cause: error,
        metadata: { fields: fastify.validation.map((issue) => issue.instancePath) },
      });
    }
    if (fastify?.statusCode === 429) return RateLimitError({ cause: error });
    if (fastify?.statusCode === 404) return NotFoundError({ cause: error });
    if (
      typeof fastify?.statusCode === 'number' &&
      fastify.statusCode >= 400 &&
      fastify.statusCode < 500
    ) {
      return ValidationError({ cause: error });
    }
    return InternalError({ cause: error });
  }
}
