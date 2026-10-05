import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { caught, makeActor, makeReply, makeReq } from '../../../helpers/fixtures.js';
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

import type { DeleteBody, DeleteResponse } from '@/controllers/team/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const { remove } = await import('@/controllers/team/delete.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<DeleteResponse> }>;
type Req = FastifyRequest<{ Body: DeleteBody }>;

const run = async (actor: Actor | null, body: DeleteBody) => {
  const { fake, reply } = makeReply<Rep>();
  await remove(makeReq<Req>({ actor, body }), reply);
  return fake;
};

describe('team.controller.delete', () => {
  it('lets an admin delete teams and dedupes ids', async () => {
    directory.set(TEAM_ID, makeTeam());
    const fake = await run(makeActor('admin'), { ids: [TEAM_ID, TEAM_ID] });
    expect(svc.delete).toHaveBeenCalledTimes(1);
    expect(fake.sent).toMatchObject({
      data: { deleted: [TEAM_ID], failed: [], success: true },
      event: 'team.deleted',
    });
  });

  it('forbids a manager even on a team they manage', async () => {
    directory.set(TEAM_ID, makeTeam());
    const error = await caught(run(makeActor('manager'), { ids: [TEAM_ID] }));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.delete).not.toHaveBeenCalled();
  });

  it('forbids an employee', async () => {
    directory.set(TEAM_ID, makeTeam());
    const error = await caught(run(makeActor('employee'), { ids: [TEAM_ID] }));
    expect(error.code).toBe('FORBIDDEN');
  });

  it('reports unknown ids and service failures without aborting the rest', async () => {
    directory.set(TEAM_ID, makeTeam());
    directory.set(OTHER_TEAM_ID, makeTeam({ id: OTHER_TEAM_ID }));
    svc.delete.mockImplementationOnce(() => Promise.reject(new Error('db down')));
    const fake = await run(makeActor('admin'), {
      ids: [MISSING_TEAM_ID, TEAM_ID, OTHER_TEAM_ID],
    });
    const data = (fake.sent as { data: DeleteResponse }).data;
    expect(data.success).toBe(false);
    expect(data.deleted).toHaveLength(1);
    expect(data.failed.map((item) => item.code).sort()).toEqual([
      'INTERNAL_ERROR',
      'TEAM_NOT_FOUND',
    ]);
  });

  it('caps the number of ids', async () => {
    const ids = Array.from(
      { length: 101 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );
    const error = await caught(run(makeActor('admin'), { ids }));
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(svc.retrieve).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const error = await caught(run(null, { ids: [TEAM_ID] }));
    expect(error.code).toBe('UNAUTHORIZED');
  });
});
