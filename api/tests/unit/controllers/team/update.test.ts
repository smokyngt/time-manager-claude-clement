import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { caught, makeActor, makeReply, makeReq, OTHER_ID } from '../../../helpers/fixtures.js';
import {
  installTeamService,
  makeTeam,
  MISSING_TEAM_ID,
  OTHER_TEAM_ID,
  TEAM_ID,
} from '../../services/team/fixtures.js';
import { installMembership } from './common.js';

const harness = await installTeamService();
const membership = await installMembership();
const { directory, svc } = harness;

afterAll(() => {
  harness.restore();
  membership.restore();
});

afterEach(() => {
  mock.clearAllMocks();
  directory.clear();
});

import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { UpdateBody, UpdateResponse } from '@/controllers/team/index.js';

const { update } = await import('@/controllers/team/update.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<UpdateResponse> }>;
type Req = FastifyRequest<{ Body: UpdateBody }>;

const run = async (actor: Actor | null, body: UpdateBody) => {
  const { fake, reply } = makeReply<Rep>();
  await update(makeReq<Req>({ actor, body }), reply);
  return fake;
};

const seed = (): void => {
  directory.set(TEAM_ID, makeTeam());
  directory.set(OTHER_TEAM_ID, makeTeam({ id: OTHER_TEAM_ID, manager_id: OTHER_ID }));
};

describe('team.controller.update', () => {
  it('dedupes ids and reports every updated id for an admin', async () => {
    seed();
    const fake = await run(makeActor('admin'), {
      data: { manager_id: OTHER_ID, name: 'Zed' },
      ids: [TEAM_ID, TEAM_ID, OTHER_TEAM_ID],
    });
    expect(svc.update).toHaveBeenCalledTimes(2);
    expect(fake.sent).toMatchObject({ data: { failed: [], success: true }, event: 'team.updated' });
    const data = (fake.sent as { data: UpdateResponse }).data;
    expect([...data.updated].sort()).toEqual([OTHER_TEAM_ID, TEAM_ID].sort());
  });

  it('lets a manager update the teams they manage', async () => {
    seed();
    const fake = await run(makeActor('manager'), { data: { name: 'X' }, ids: [TEAM_ID] });
    expect(fake.sent).toMatchObject({ data: { success: true, updated: [TEAM_ID] } });
  });

  it('forbids a manager from reassigning the manager', async () => {
    seed();
    const error = await caught(
      run(makeActor('manager'), { data: { manager_id: OTHER_ID }, ids: [TEAM_ID] }),
    );
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('checks every item before any write: one forbidden item blocks the request', async () => {
    seed();
    const error = await caught(
      run(makeActor('manager'), { data: { name: 'X' }, ids: [TEAM_ID, OTHER_TEAM_ID] }),
    );
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('forbids an employee', async () => {
    seed();
    const error = await caught(run(makeActor('employee'), { data: { name: 'X' }, ids: [TEAM_ID] }));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.retrieve).not.toHaveBeenCalled();
  });

  it('reports unknown ids and service failures without aborting the rest', async () => {
    seed();
    const { TeamManagerInvalidError } = await import('@/lib/errors/domains/team.js');
    svc.update.mockImplementationOnce(() => Promise.reject(TeamManagerInvalidError()));
    const fake = await run(makeActor('admin'), {
      data: { name: 'X' },
      ids: [MISSING_TEAM_ID, TEAM_ID, OTHER_TEAM_ID],
    });
    const data = (fake.sent as { data: UpdateResponse }).data;
    expect(data.success).toBe(false);
    expect(data.updated).toHaveLength(1);
    expect(data.failed.map((item) => item.code).sort()).toEqual([
      'TEAM_MANAGER_INVALID',
      'TEAM_NOT_FOUND',
    ]);
  });

  it('caps the number of ids', async () => {
    const ids = Array.from(
      { length: 101 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );
    const error = await caught(run(makeActor('admin'), { data: { name: 'X' }, ids }));
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.status).toBe(400);
    expect(svc.retrieve).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const error = await caught(run(null, { data: { name: 'X' }, ids: [TEAM_ID] }));
    expect(error.code).toBe('UNAUTHORIZED');
  });
});
