import { afterAll, beforeAll, describe, it, mock } from 'bun:test';

import {
  TeamArchived,
  TeamCreated,
  TeamDeleted,
  TeamListed,
  TeamRestored,
  TeamRetrieved,
  TeamUpdated,
} from '@/lib/events/domains/team.js';
import { Reply } from '@/utils/http/reply.js';

import { Prehandler } from '../../../support/prehandler.js';
import { TEAM_ID, teamOf } from '../../services/team/support.js';

import type { PrehandlerRoute } from '../../../support/prehandler.js';
import type { AppEvent } from '@/lib/events/base/registry.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const realControllers = { ...(await import('@/controllers/team/index.js')) };

const actor = '00000000-0000-4000-8000-0000000000c1';
const team = teamOf(TEAM_ID);
const page = { items: [team], more: false, next: null, total: 1 };

const answer =
  <Data, Payload>(event: AppEvent<Payload>, data: Data) =>
  (req: FastifyRequest, reply: FastifyReply<{ Reply: ReplyEnvelope<Data> }>): Promise<void> =>
    Reply.send(req, reply, event, data);

await mock.module('@/controllers/team/index.js', () => ({
  ...realControllers,
  teamController: {
    archive: answer(TeamArchived({ payload: { actor, team_id: TEAM_ID } }), { team }),
    create: answer(TeamCreated({ payload: { actor, team_id: TEAM_ID } }), { team }),
    delete: answer(TeamDeleted({ payload: { actor, deleted: 0, failed: 0 } }), {
      deleted: [],
      failed: [],
      success: true,
    }),
    list: answer(TeamListed({ payload: { actor, count: 1, total: 1 } }), page),
    restore: answer(TeamRestored({ payload: { actor, team_id: TEAM_ID } }), { team }),
    retrieve: answer(TeamRetrieved({ payload: { actor, team_id: TEAM_ID } }), { team }),
    update: answer(TeamUpdated({ payload: { actor, failed: 0, updated: 0 } }), {
      failed: [],
      success: true,
      updated: [],
    }),
  },
}));

const { teams } = await import('@/routes/team/index.js');

type Definition = {
  body?: unknown;
  method: PrehandlerRoute['method'];
  name: string;
  scope: 'teams:manage' | 'teams:read';
  url: string;
};

const BASE = '/v1/teams';

const definitions: Definition[] = [
  { body: { name: 'Customer support' }, method: 'POST', name: 'create', scope: 'teams:manage', url: `${BASE}/new` },
  { body: {}, method: 'POST', name: 'list', scope: 'teams:read', url: `${BASE}/list` },
  {
    body: { data: { name: 'Customer care' }, ids: [TEAM_ID] },
    method: 'PATCH',
    name: 'update',
    scope: 'teams:manage',
    url: BASE,
  },
  { body: { ids: [TEAM_ID] }, method: 'DELETE', name: 'delete', scope: 'teams:manage', url: BASE },
  { method: 'GET', name: 'retrieve', scope: 'teams:read', url: `${BASE}/${TEAM_ID}` },
  { method: 'POST', name: 'archive', scope: 'teams:manage', url: `${BASE}/${TEAM_ID}/archive` },
  { method: 'POST', name: 'restore', scope: 'teams:manage', url: `${BASE}/${TEAM_ID}/restore` },
];

let routes: Map<string, PrehandlerRoute>;
let closer: () => Promise<void>;

beforeAll(async () => {
  Prehandler.install();
  const app = await Prehandler.app(teams, BASE);
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
  void mock.module('@/controllers/team/index.js', () => realControllers);
});

describe.each(definitions)('routes.team.$name', (definition) => {
  const route = (): PrehandlerRoute => routes.get(definition.name) as PrehandlerRoute;

  it(`allows the ${definition.scope} scope`, async () => {
    await Prehandler.allowed(route(), definition.scope);
  });

  it('denies a foreign scope', async () => {
    await Prehandler.denied(route(), 'users:manage');
  });

  it('rejects anonymous callers', async () => {
    await Prehandler.unauthenticated(route());
  });
});

describe('routes.team scopes', () => {
  const mutations = definitions.filter((item) => item.method !== 'GET' && item.name !== 'list');

  it.each(mutations)('denies the read scope on $name', async (definition) => {
    await Prehandler.denied(routes.get(definition.name) as PrehandlerRoute, 'teams:read');
  });

  it('denies the manage scope on reads', async () => {
    await Prehandler.denied(routes.get('retrieve') as PrehandlerRoute, 'teams:manage');
    await Prehandler.denied(routes.get('list') as PrehandlerRoute, 'teams:manage');
  });
});
