import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import { Fake } from '../../../support/fake.js';
import {
  actorOf,
  ADMIN_ID,
  caught,
  MANAGER_ID,
  MISSING_ID,
  OTHER_MANAGER_ID,
  OTHER_TEAM_ID,
  teamOf,
  TEAM_ID,
} from '../../services/team/support.js';
import { installMembers, installTeamService } from './support.js';

import type { FakeReply } from '../../../support/fake.js';
import type { UpdateBody, UpdateResponse } from '@/controllers/team/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/misc/reply.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const harness = await installTeamService();
const members = await installMembers();
const { directory, svc } = harness;

afterAll(() => {
  harness.restore();
  members.restore();
});

afterEach(() => {
  mock.clearAllMocks();
  directory.clear();
  members.fakeDb.reset();
});

const { update } = await import('@/controllers/team/update.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<UpdateResponse> }>;
type Req = FastifyRequest<{ Body: UpdateBody }>;

const run = async (actor: Actor | undefined, body: UpdateBody) => {
  const reply: FakeReply = Fake.reply();
  await update(Fake.request({ actor, body }) as Req, reply as unknown as Rep);

  return reply;
};

const seed = (): void => {
  directory.set(TEAM_ID, teamOf(TEAM_ID, MANAGER_ID));
  directory.set(OTHER_TEAM_ID, teamOf(OTHER_TEAM_ID, OTHER_MANAGER_ID));
};

describe('team.controller.update', () => {
  it('dedupes ids and reports every updated id for an admin', async () => {
    seed();
    const reply = await run(actorOf('admin'), {
      data: { manager_id: OTHER_MANAGER_ID, name: 'Care' },
      ids: [TEAM_ID, TEAM_ID, OTHER_TEAM_ID],
    });
    expect(svc.update).toHaveBeenCalledTimes(2);
    expect(reply.payload).toMatchObject({
      data: { failed: [], success: true },
      event: { code: 'team.updated', payload: { actor: ADMIN_ID, failed: 0, updated: 2 } },
    });
    const data = (reply.payload as ReplyEnvelope<UpdateResponse>).data;
    expect([...data.updated].sort()).toEqual([OTHER_TEAM_ID, TEAM_ID].sort());
  });

  it('lets a manager update a team they manage', async () => {
    seed();
    const reply = await run(actorOf('manager'), { data: { name: 'Care' }, ids: [TEAM_ID] });
    expect(reply.payload).toMatchObject({ data: { success: true, updated: [TEAM_ID] } });
  });

  it('forbids a manager from changing the manager', async () => {
    seed();
    const error = await caught(
      run(actorOf('manager'), { data: { manager_id: OTHER_MANAGER_ID }, ids: [TEAM_ID] }),
    );
    expect(error.code).toBe('unauthorized');
    expect(error.status).toBe(403);
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('reports a team of another manager as not found and updates the rest', async () => {
    seed();
    const reply = await run(actorOf('manager'), {
      data: { name: 'Care' },
      ids: [TEAM_ID, OTHER_TEAM_ID],
    });
    expect(svc.update).toHaveBeenCalledTimes(1);
    expect(reply.payload).toMatchObject({
      data: { failed: [{ code: 'team.not.found', id: OTHER_TEAM_ID }], updated: [TEAM_ID] },
    });
  });

  it('forbids a manager who is only a member', async () => {
    seed();
    members.member(true);
    const error = await caught(
      run(actorOf('manager'), { data: { name: 'Care' }, ids: [OTHER_TEAM_ID] }),
    );
    expect(error.code).toBe('unauthorized');
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('forbids an employee member', async () => {
    seed();
    members.member(true);
    const error = await caught(
      run(actorOf('employee'), { data: { name: 'Care' }, ids: [TEAM_ID] }),
    );
    expect(error.code).toBe('unauthorized');
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('never updates anything when one item is forbidden', async () => {
    seed();
    members.member(true);
    const error = await caught(
      run(actorOf('manager'), { data: { name: 'Care' }, ids: [TEAM_ID, OTHER_TEAM_ID] }),
    );
    expect(error.code).toBe('unauthorized');
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('reports unknown ids and service failures without aborting the rest', async () => {
    seed();
    const { TeamScheduleInvalidError } = await import('@/lib/errors/domains/team.js');
    svc.update.mockImplementationOnce(() => Promise.reject(TeamScheduleInvalidError()));
    const reply = await run(actorOf('admin'), {
      data: { name: 'Care' },
      ids: [MISSING_ID, TEAM_ID, OTHER_TEAM_ID],
    });
    const data = (reply.payload as ReplyEnvelope<UpdateResponse>).data;
    expect(data.success).toBe(false);
    expect(data.updated).toHaveLength(1);
    expect(data.failed.map((item) => item.code).sort()).toEqual([
      'team.not.found',
      'team.schedule.invalid',
    ]);
  });

  it('caps the number of ids', async () => {
    const ids = Array.from(
      { length: 101 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );
    const error = await caught(run(actorOf('admin'), { data: { name: 'Care' }, ids }));
    expect(error.code).toBe('validation.error');
    expect(error.status).toBe(400);
    expect(svc.retrieve).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const error = await caught(run(undefined, { data: { name: 'Care' }, ids: [TEAM_ID] }));
    expect(error.code).toBe('token.authentication.failed');
    expect(error.status).toBe(401);
  });

  it('wraps unexpected failures with the controller route', async () => {
    seed();
    const failure = new Error('boom');
    svc.retrieve.mockImplementationOnce(() => {
      throw failure;
    });
    const error = await caught(run(actorOf('admin'), { data: { name: 'Care' }, ids: [TEAM_ID] }));
    expect(error.code).toBe('team.update.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.controller.update');
  });
});
