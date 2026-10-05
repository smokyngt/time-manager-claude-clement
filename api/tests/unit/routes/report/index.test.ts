import { afterAll, beforeAll, describe, it } from 'bun:test';

import { reports } from '@/routes/report/index.js';

import { Prehandler } from '../../../support/prehandler.js';

import type { PrehandlerRoute } from '../../../support/prehandler.js';

const FROM = 1_767_225_600_000;
const TO = FROM + 86_400_000;
const USER_ID = '00000000-0000-4000-8000-0000000000c2';
const TEAM_ID = '00000000-0000-4000-8000-0000000000e1';

let team: PrehandlerRoute;
let user: PrehandlerRoute;

beforeAll(async () => {
  Prehandler.install();
  const app = await Prehandler.app(reports, '/v1/reports');
  team = {
    app,
    body: { from: FROM, granularity: 'day', team_id: TEAM_ID, to: TO },
    method: 'POST',
    url: '/v1/reports/team',
  };
  user = {
    app,
    body: { from: FROM, granularity: 'day', to: TO, user_id: USER_ID },
    method: 'POST',
    url: '/v1/reports/user',
  };
});

afterAll(async () => {
  await user.app.close();
  Prehandler.restore();
});

describe('report.routes', () => {
  it('allows reports:read on the team report', async () => {
    await Prehandler.allowed(team, 'reports:read');
  });

  it('allows reports:read on the user report', async () => {
    await Prehandler.allowed(user, 'reports:read');
  });

  it('denies another scope on the team report', async () => {
    await Prehandler.denied(team, 'clocks:read');
  });

  it('denies another scope on the user report', async () => {
    await Prehandler.denied(user, 'clocks:read');
  });

  it('rejects anonymous callers on the team report', async () => {
    await Prehandler.unauthenticated(team);
  });

  it('rejects anonymous callers on the user report', async () => {
    await Prehandler.unauthenticated(user);
  });
});
