import { afterAll, beforeAll, describe, it } from 'bun:test';

import { teamMembers } from '@/routes/team-member/index.js';

import { Prehandler } from '../../../support/prehandler.js';

import type { PrehandlerRoute } from '../../../support/prehandler.js';

const TEAM_ID = '00000000-0000-4000-8000-0000000000e1';
const URL = `/v1/teams/${TEAM_ID}/members`;

const IDS = ['00000000-0000-4000-8000-0000000000c2'];

let add: PrehandlerRoute;
let addValid: PrehandlerRoute;
let list: PrehandlerRoute;
let listValid: PrehandlerRoute;
let remove: PrehandlerRoute;
let removeValid: PrehandlerRoute;

beforeAll(async () => {
  Prehandler.install();
  const app = await Prehandler.app(teamMembers, '/v1/teams');
  add = { app, body: { user_ids: [] }, method: 'POST', url: `${URL}/add` };
  list = { app, body: { limit: 0 }, method: 'POST', url: `${URL}/list` };
  remove = { app, body: { user_ids: [] }, method: 'POST', url: `${URL}/remove` };
  addValid = { ...add, body: { user_ids: IDS } };
  listValid = { ...list, body: {} };
  removeValid = { ...remove, body: { user_ids: IDS } };
});

afterAll(() => {
  Prehandler.restore();
});

describe('team member routes prehandler', () => {
  it('allows teams:manage to add members', async () => {
    await Prehandler.allowed(add, 'teams:manage');
  });

  it('denies teams:read for add', async () => {
    await Prehandler.denied(addValid, 'teams:read');
  });

  it('rejects an anonymous add', async () => {
    await Prehandler.unauthenticated(addValid);
  });

  it('allows teams:manage to remove members', async () => {
    await Prehandler.allowed(remove, 'teams:manage');
  });

  it('denies teams:read for remove', async () => {
    await Prehandler.denied(removeValid, 'teams:read');
  });

  it('rejects an anonymous remove', async () => {
    await Prehandler.unauthenticated(removeValid);
  });

  it('allows teams:read to list members', async () => {
    await Prehandler.allowed(list, 'teams:read');
  });

  it('denies a token without teams:read for list', async () => {
    await Prehandler.denied(listValid, 'clocks:read');
  });

  it('rejects an anonymous list', async () => {
    await Prehandler.unauthenticated(listValid);
  });
});
