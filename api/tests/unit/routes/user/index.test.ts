import { afterAll, beforeAll, describe, it, mock } from 'bun:test';

import { UserArchived, UserCreated, UserDeleted, UserListed, UserRestored, UserRetrieved, UserUpdated } from '@/lib/events/domains/user.js';
import { Reply } from '@/utils/http/reply.js';

import { Prehandler } from '../../../support/prehandler.js';
import { OTHER_ID, userOf } from '../../services/user/support.js';

import type { PrehandlerRoute } from '../../../support/prehandler.js';
import type { AppEvent } from '@/lib/events/base/registry.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const realControllers = { ...(await import('@/controllers/user/index.js')) };

const actor = OTHER_ID;
const user = userOf('employee', OTHER_ID);
const page = { items: [user], more: false, next: null, total: 1 };

const answer =
  <Data, Payload>(event: AppEvent<Payload>, data: Data) =>
  (req: FastifyRequest, reply: FastifyReply<{ Reply: ReplyEnvelope<Data> }>): Promise<void> =>
    Reply.send(req, reply, event, data);

await mock.module('@/controllers/user/index.js', () => ({
  ...realControllers,
  user: {
    archive: answer(UserArchived({ payload: { actor, user_id: OTHER_ID } }), { user }),
    create: answer(UserCreated({ payload: { actor, user_id: OTHER_ID } }), { user }),
    delete: answer(UserDeleted({ payload: { actor, deleted: 0, failed: 0 } }), {
      deleted: [],
      failed: [],
      success: true,
    }),
    list: answer(UserListed({ payload: { actor, count: 1, total: 1 } }), page),
    restore: answer(UserRestored({ payload: { actor, user_id: OTHER_ID } }), { user }),
    retrieve: answer(UserRetrieved({ payload: { actor, user_id: OTHER_ID } }), { user }),
    update: answer(UserUpdated({ payload: { actor, failed: 0, updated: 0 } }), {
      failed: [],
      success: true,
      updated: [],
    }),
  },
}));

const { users } = await import('@/routes/user/index.js');

type Definition = {
  body?: unknown;
  method: PrehandlerRoute['method'];
  name: string;
  scope: 'users:manage' | 'users:read' | 'users:write';
  url: string;
};

const BASE = '/v1/users';

const definitions: Definition[] = [
  {
    body: { email: 'jane.doe@example.com', first_name: 'Jane', last_name: 'Doe' },
    method: 'POST',
    name: 'create',
    scope: 'users:manage',
    url: `${BASE}/new`,
  },
  { body: {}, method: 'POST', name: 'list', scope: 'users:manage', url: `${BASE}/list` },
  {
    body: { data: { first_name: 'Jane' }, ids: [OTHER_ID] },
    method: 'PATCH',
    name: 'update',
    scope: 'users:write',
    url: BASE,
  },
  {
    body: { ids: [OTHER_ID] },
    method: 'DELETE',
    name: 'delete',
    scope: 'users:manage',
    url: BASE,
  },
  { method: 'GET', name: 'retrieve', scope: 'users:read', url: `${BASE}/${OTHER_ID}` },
  {
    method: 'POST',
    name: 'archive',
    scope: 'users:manage',
    url: `${BASE}/${OTHER_ID}/archive`,
  },
  {
    method: 'POST',
    name: 'restore',
    scope: 'users:manage',
    url: `${BASE}/${OTHER_ID}/restore`,
  },
];

let routes: Map<string, PrehandlerRoute>;
let closer: () => Promise<void>;

beforeAll(async () => {
  Prehandler.install();
  const app = await Prehandler.app(users, BASE);
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
  void mock.module('@/controllers/user/index.js', () => realControllers);
});

describe.each(definitions)('routes.user.$name', (definition) => {
  const route = (): PrehandlerRoute => routes.get(definition.name) as PrehandlerRoute;

  it(`allows the ${definition.scope} scope`, async () => {
    await Prehandler.allowed(route(), definition.scope);
  });

  it('denies a foreign scope', async () => {
    await Prehandler.denied(route(), 'teams:manage');
  });

  it('rejects anonymous callers', async () => {
    await Prehandler.unauthenticated(route());
  });
});

describe('routes.user scopes', () => {
  const mutations = definitions.filter((item) => item.method !== 'GET');

  it.each(mutations)('denies the read scope on $name', async (definition) => {
    await Prehandler.denied(routes.get(definition.name) as PrehandlerRoute, 'users:read');
  });

  it('requires the write scope, not manage, for updates', async () => {
    await Prehandler.denied(routes.get('update') as PrehandlerRoute, 'users:manage');
  });

  it('denies the write scope on reads and manage routes', async () => {
    await Prehandler.denied(routes.get('retrieve') as PrehandlerRoute, 'users:write');
    await Prehandler.denied(routes.get('create') as PrehandlerRoute, 'users:write');
  });
});
