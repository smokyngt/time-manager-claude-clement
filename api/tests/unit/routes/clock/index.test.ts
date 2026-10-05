import { afterAll, beforeAll, describe, it, mock } from 'bun:test';

import {
  ClockCreated,
  ClockCurrentRetrieved,
  ClockDeleted,
  ClockListed,
  ClockRetrieved,
  ClockStarted,
  ClockStopped,
  ClockUpdated,
} from '@/lib/events/domains/clock.js';
import { Reply } from '@/utils/http/reply.js';

import { Prehandler } from '../../../support/prehandler.js';
import { clockOf, OTHER_CLOCK_ID, OWNER_ID } from '../../services/clock/support.js';

import type { PrehandlerRoute } from '../../../support/prehandler.js';
import type { AppEvent } from '@/lib/events/base/registry.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const realControllers = { ...(await import('@/controllers/clock/index.js')) };

const actor = OWNER_ID;
const clock = clockOf(OWNER_ID, OTHER_CLOCK_ID);
const page = { items: [clock], more: false, next: null, total: 1 };

const answer =
  <Data, Payload>(event: AppEvent<Payload>, data: Data) =>
  (req: FastifyRequest, reply: FastifyReply<{ Reply: ReplyEnvelope<Data> }>): Promise<void> =>
    Reply.send(req, reply, event, data);

await mock.module('@/controllers/clock/index.js', () => ({
  ...realControllers,
  clock: {
    clockIn: answer(ClockStarted({ payload: { actor, clock_id: OTHER_CLOCK_ID } }), { clock }),
    clockOut: answer(ClockStopped({ payload: { actor, clock_id: OTHER_CLOCK_ID } }), { clock }),
    create: answer(ClockCreated({ payload: { actor, clock_id: OTHER_CLOCK_ID } }), { clock }),
    current: answer(ClockCurrentRetrieved({ payload: { actor, open: false } }), { clock: null }),
    delete: answer(ClockDeleted({ payload: { actor, deleted: 0, failed: 0 } }), {
      deleted: [],
      failed: [],
      success: true,
    }),
    list: answer(ClockListed({ payload: { actor, count: 1, total: 1 } }), page),
    retrieve: answer(ClockRetrieved({ payload: { actor, clock_id: OTHER_CLOCK_ID } }), { clock }),
    update: answer(ClockUpdated({ payload: { actor, failed: 0, updated: 0 } }), {
      failed: [],
      success: true,
      updated: [],
    }),
  },
}));

const { clocks } = await import('@/routes/clock/index.js');

type Definition = {
  body?: unknown;
  method: PrehandlerRoute['method'];
  name: string;
  scope: 'clocks:manage' | 'clocks:read' | 'clocks:write';
  url: string;
};

const BASE = '/v1/clocks';

const definitions: Definition[] = [
  { body: {}, method: 'POST', name: 'in', scope: 'clocks:write', url: `${BASE}/in` },
  { body: {}, method: 'POST', name: 'out', scope: 'clocks:write', url: `${BASE}/out` },
  { method: 'GET', name: 'current', scope: 'clocks:read', url: `${BASE}/current` },
  {
    body: {
      clocked_in_at: 1_700_000_000_000,
      clocked_out_at: 1_700_028_800_000,
      user_id: OWNER_ID,
    },
    method: 'POST',
    name: 'create',
    scope: 'clocks:manage',
    url: `${BASE}/new`,
  },
  { body: {}, method: 'POST', name: 'list', scope: 'clocks:read', url: `${BASE}/list` },
  { method: 'GET', name: 'retrieve', scope: 'clocks:read', url: `${BASE}/${OTHER_CLOCK_ID}` },
  {
    body: { data: { note: null }, ids: [OTHER_CLOCK_ID] },
    method: 'PATCH',
    name: 'update',
    scope: 'clocks:manage',
    url: BASE,
  },
  {
    body: { ids: [OTHER_CLOCK_ID] },
    method: 'DELETE',
    name: 'delete',
    scope: 'clocks:manage',
    url: BASE,
  },
];

let routes: Map<string, PrehandlerRoute>;
let closer: () => Promise<void>;

const get = (name: string): PrehandlerRoute => routes.get(name) as PrehandlerRoute;

beforeAll(async () => {
  Prehandler.install();
  const app = await Prehandler.app(clocks, BASE);
  routes = new Map(
    definitions.map((item) => [
      item.name,
      { app, body: item.body, method: item.method, url: item.url },
    ]),
  );
  closer = () => app.close();
});

afterAll(async () => {
  await closer();
  Prehandler.restore();
  void mock.module('@/controllers/clock/index.js', () => realControllers);
});

describe.each(definitions)('routes.clock.$name', (definition) => {
  it(`allows the ${definition.scope} scope`, async () => {
    await Prehandler.allowed(get(definition.name), definition.scope);
  });

  it('denies a foreign scope', async () => {
    await Prehandler.denied(get(definition.name), 'teams:manage');
  });

  it('rejects anonymous callers', async () => {
    await Prehandler.unauthenticated(get(definition.name));
  });
});

describe('routes.clock scopes', () => {
  it('denies the read scope on clocking and manual mutations', async () => {
    for (const name of ['in', 'out', 'create', 'update', 'delete']) {
      await Prehandler.denied(get(name), 'clocks:read');
    }
  });

  it('denies the write scope on reads and manager mutations', async () => {
    for (const name of ['current', 'list', 'retrieve', 'create', 'update', 'delete']) {
      await Prehandler.denied(get(name), 'clocks:write');
    }
  });

  it('denies the manage scope on clocking so only the owner flow uses write', async () => {
    await Prehandler.denied(get('in'), 'clocks:manage');
    await Prehandler.denied(get('out'), 'clocks:manage');
  });

  it('serves /current before /:id', async () => {
    await Prehandler.allowed(get('current'), 'clocks:read');
  });
});
