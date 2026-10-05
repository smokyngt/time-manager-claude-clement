import { Config } from '@/config/index.js';

import type { FastifyReply } from 'fastify';

export class Cookies {
  public static readonly oauth = 'tm_oauth';
  public static readonly refresh = 'tm_refresh';

  /**
   * @route cookies.clear
   * @param {FastifyReply} reply
   * @returns {void}
   */
  public static clear(reply: FastifyReply): void {
    reply.clearCookie(Cookies.refresh, Cookies.options(0));
  }

  /**
   * @route cookies.options
   * @param {number} maxAge
   * @param {string} path
   * @returns {{ httpOnly: boolean; maxAge: number; path: string; sameSite: 'lax'; secure: boolean }}
   */
  public static options(
    maxAge: number,
    path = '/v1/auth',
  ): { httpOnly: boolean; maxAge: number; path: string; sameSite: 'lax'; secure: boolean } {
    return { httpOnly: true, maxAge, path, sameSite: 'lax', secure: Config.production() };
  }

  /**
   * @route cookies.set
   * @param {FastifyReply} reply
   * @param {string} token
   * @param {number} maxAge
   * @returns {void}
   */
  public static set(reply: FastifyReply, token: string, maxAge: number): void {
    reply.setCookie(Cookies.refresh, token, Cookies.options(maxAge));
  }
}
