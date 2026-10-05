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
import type { DeleteBody, DeleteResponse } from '@/controllers/team/index.js';
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

const { remove } = await import('@/controllers/team/delete.js');

type Rep = FastifyReply<{ Reply: ReplyEnvelope<DeleteResponse> }>;
type Req = FastifyRequest<{ Body: DeleteBody }>;

const run = async (actor: Actor | undefined, body: DeleteBody) => {
  const reply: FakeReply = Fake.reply();
  await remove(Fake.request({ actor, body }) as Req, reply as unknown as Rep);

  return reply;
};

const seed = (): void => {
  directory.set(TEAM_ID, teamOf(TEAM_ID, MANAGER_ID));
  directory.set(OTHER_TEAM_ID, teamOf(OTHER_TEAM_ID, OTHER_MANAGER_ID));
};

describe('team.controller.delete', () => {
  it('lets an admin delete teams and dedupes ids', async () => {
    seed();
    const reply = await run(actorOf('admin'), { ids: [TEAM_ID, TEAM_ID, OTHER_TEAM_ID] });
    expect(svc.delete).toHaveBeenCalledTimes(2);
    expect(reply.payload).toMatchObject({
      data: { failed: [], success: true },
      event: { code: 'team.deleted', payload: { actor: ADMIN_ID, deleted: 2, failed: 0 } },
    });
    const data = (reply.payload as ReplyEnvelope<DeleteResponse>).data;
    expect([...data.deleted].sort()).toEqual([OTHER_TEAM_ID, TEAM_ID].sort());
  });

  it('forbids a manager from deleting a team they manage', async () => {
    seed();
    const error = await caught(run(actorOf('manager'), { ids: [TEAM_ID] }));
    expect(error.code).toBe('unauthorized');
    expect(error.status).toBe(403);
    expect(svc.delete).not.toHaveBeenCalled();
  });

  it('reports an invisible team as not found to a manager', async () => {
    seed();
    const reply = await run(actorOf('manager'), { ids: [OTHER_TEAM_ID] });
    expect(reply.payload).toMatchObject({
      data: { deleted: [], failed: [{ code: 'team.not.found', id: OTHER_TEAM_ID }], success: false },
    });
    expect(svc.delete).not.toHaveBeenCalled();
  });

  it('forbids employees who belong to the team', async () => {
    seed();
    members.member(true);
    const error = await caught(run(actorOf('employee'), { ids: [TEAM_ID] }));
    expect(error.code).toBe('unauthorized');
    expect(svc.delete).not.toHaveBeenCalled();
  });

  it('never deletes anything when one item is forbidden', async () => {
    seed();
    members.member(true);
    const error = await caught(run(actorOf('manager', OTHER_MANAGER_ID), { ids: [OTHER_TEAM_ID, TEAM_ID] }));
    expect(error.code).toBe('unauthorized');
    expect(svc.delete).not.toHaveBeenCalled();
  });

  it('reports unknown ids in failed', async () => {
    seed();
    const reply = await run(actorOf('admin'), { ids: [MISSING_ID, TEAM_ID] });
    expect(reply.payload).toMatchObject({
      data: {
        deleted: [TEAM_ID],
        failed: [{ code: 'team.not.found', id: MISSING_ID }],
        success: false,
      },
    });
  });

  it('reports service failures in failed', async () => {
    seed();
    svc.delete.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    const reply = await run(actorOf('admin'), { ids: [TEAM_ID] });
    expect(reply.payload).toMatchObject({
      data: { deleted: [], failed: [{ code: 'internal.unexpected', id: TEAM_ID }], success: false },
    });
  });

  it('caps the number of ids', async () => {
    const ids = Array.from(
      { length: 101 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );
    const error = await caught(run(actorOf('admin'), { ids }));
    expect(error.code).toBe('validation.error');
    expect(error.status).toBe(400);
    expect(svc.retrieve).not.toHaveBeenCalled();
  });

  it('rejects anonymous callers', async () => {
    const error = await caught(run(undefined, { ids: [TEAM_ID] }));
    expect(error.code).toBe('token.authentication.failed');
    expect(error.status).toBe(401);
  });

  it('wraps unexpected failures with the controller route', async () => {
    seed();
    const failure = new Error('boom');
    svc.retrieve.mockImplementationOnce(() => {
      throw failure;
    });
    const error = await caught(run(actorOf('admin'), { ids: [TEAM_ID] }));
    expect(error.code).toBe('team.delete.failed');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team.controller.delete');
  });
});
