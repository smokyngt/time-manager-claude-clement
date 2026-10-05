import { expect, spyOn } from 'bun:test';

import { Roles } from '@/config/auth/roles.js';
import { Tokens } from '@/lib/auth/tokens.js';
import { Identity } from '@/middlewares/auth/identity.js';

import type { Scope } from '@/config/auth/scopes.js';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

export type PrehandlerRoute = {
  app: FastifyInstance;
  body?: unknown;
  method: 'DELETE' | 'GET' | 'PATCH' | 'POST';
  url: string;
};

const USER_ID = '00000000-0000-4000-8000-0000000000c1';

export class Prehandler {
  private static granted: readonly Scope[] = [];
  private static readonly spies: { mockRestore: () => void }[] = [];

  /**
   * @route prehandler.allowed
   * @param {PrehandlerRoute} route
   * @param {Scope} scope
   * @returns {Promise<void>}
   */
  public static async allowed(route: PrehandlerRoute, scope: Scope): Promise<void> {
    const result = await Prehandler.call(route, [scope]);
    expect([401, 403]).not.toContain(result.status);
  }

  /**
   * @route prehandler.app
   * @param {FastifyPluginAsync} router
   * @param {string} prefix
   * @returns {Promise<FastifyInstance>}
   */
  public static async app(router: FastifyPluginAsync, prefix: string): Promise<FastifyInstance> {
    const { build } = await import('@/app.v2.js');
    const app = await build({ logger: false });
    await app.register(router, { prefix });
    await app.ready();

    return app;
  }

  /**
   * @route prehandler.denied
   * @param {PrehandlerRoute} route
   * @param {Scope} scope
   * @returns {Promise<void>}
   */
  public static async denied(route: PrehandlerRoute, scope: Scope): Promise<void> {
    const result = await Prehandler.call(route, [scope]);
    expect(result.status).toBe(403);
    expect(result.code).toBe('unauthorized');
  }

  /**
   * @route prehandler.install
   * @returns {void}
   */
  public static install(): void {
    if (Prehandler.spies.length > 0) return;
    Prehandler.spies.push(
      spyOn(Roles, 'scopes').mockImplementation(() => Prehandler.granted),
      spyOn(Identity, 'load').mockImplementation((actorId: string) =>
        Promise.resolve({ id: actorId, role: 'employee', team_ids: [] }),
      ),
    );
  }

  /**
   * @route prehandler.restore
   * @returns {void}
   */
  public static restore(): void {
    for (const spy of Prehandler.spies) spy.mockRestore();
    Prehandler.spies.length = 0;
  }

  /**
   * @route prehandler.unauthenticated
   * @param {PrehandlerRoute} route
   * @returns {Promise<void>}
   */
  public static async unauthenticated(route: PrehandlerRoute): Promise<void> {
    const response = await route.app.inject({
      method: route.method,
      payload: route.body as object | undefined,
      url: route.url,
    });
    expect(response.statusCode).toBe(401);
  }

  private static async call(
    route: PrehandlerRoute,
    scopes: readonly Scope[],
  ): Promise<{ code: string; status: number }> {
    Prehandler.install();
    Prehandler.granted = scopes;
    const { token } = await Tokens.access({ id: USER_ID, role: 'employee' });
    const response = await route.app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: route.method,
      payload: route.body as object | undefined,
      url: route.url,
    });
    const body = response.json<{ code?: string }>();

    return { code: body.code ?? '', status: response.statusCode };
  }
}
