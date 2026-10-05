import { Tokens } from '@/lib/auth/tokens.js';
import { RateLimitError } from '@/lib/errors/base/core.js';

import type { ErrorEnvelope } from '@/types/misc/reply.js';
import type { FastifyRequest } from 'fastify';

export type RateLimitContext = {
  after?: string;
  max?: number;
  ttl?: number;
};

export type RateLimitProblem = { retry_after: number; statusCode: number } & ErrorEnvelope;

export class RateLimit {
  /**
   * @route rate_limit.error
   * @param {FastifyRequest} req
   * @param {RateLimitContext} context
   * @returns {RateLimitProblem}
   */
  public static error(req: FastifyRequest, context: RateLimitContext = {}): RateLimitProblem {
    const retry = Math.max(1, Math.ceil((context.ttl ?? 1000) / 1000));
    const index = req.url.indexOf('?');

    return {
      code: RateLimitError.code,
      correlation_id: req.id,
      instance: index === -1 ? req.url : req.url.slice(0, index),
      retry_after: retry,
      status: RateLimitError.defaultStatus,
      statusCode: RateLimitError.defaultStatus,
      timestamp: Date.now(),
    };
  }

  /**
   * @route rate_limit.key
   * @param {FastifyRequest} req
   * @returns {Promise<string>}
   */
  public static async key(req: FastifyRequest): Promise<string> {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ') === true) {
      const actor = await Tokens.verify(header.slice(7)).catch(() => null);
      if (actor !== null) return `user:${actor.id}`;
    }

    return `ip:${req.ip}`;
  }
}
