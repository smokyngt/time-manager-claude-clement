import type { FastifyRequest } from 'fastify';

import { Config } from '@/config/index.js';
import { RateLimitError } from '@/lib/errors/index.js';
import { Tokens } from '@/lib/auth/tokens.js';

import type { AppError } from '@/lib/errors/index.js';

export interface RateLimitOptions {
  errorResponseBuilder: typeof RateLimit.error;
  global: boolean;
  keyGenerator: typeof RateLimit.key;
  max: number;
  timeWindow: string;
}

export class RateLimit {
  /**
   * @route rate_limit.error
   * @param {FastifyRequest} req
   * @returns {AppError}
   */
  public static error(req: FastifyRequest): AppError {
    return RateLimitError({ metadata: { route: 'rate_limit', url: req.routeOptions.url } });
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

  /**
   * @route rate_limit.options
   * @param {string} entity
   * @returns {RateLimitOptions}
   */
  public static options(entity: string): RateLimitOptions {
    const prefix = entity.toUpperCase();
    return {
      errorResponseBuilder: RateLimit.error,
      global: true,
      keyGenerator: RateLimit.key,
      max: Config.store.number(`${prefix}_RATE_LIMIT_MAX`, 100),
      timeWindow: Config.store.text(`${prefix}_RATE_LIMIT_WINDOW`, '1 minute'),
    };
  }
}
