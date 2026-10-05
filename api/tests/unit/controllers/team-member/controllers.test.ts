import { afterAll, afterEach, describe, expect, it, mock } from 'bun:test';

import {
  caught,
  makeActor,
  makeReply,
  makeReq,
  MISSING_ID,
  OTHER_ID,
} from '../../../helpers/fixtures.js';

const real = { ...(await import('@/services/team-member/index.js')) };
const svc = {
  add: mock((_params: unknown) =>
    Promise.resolve({ added: [OTHER_ID], failed: [], success: true }),
  ),
  list: mock((_params: unknown) =>
    Promise.resolve({ items: [], more: false, next: null, total: 0 }),
  ),
  remove: mock((_params: unknown) =>
    Promise.resolve({ failed: [], removed: [OTHER_ID], success: true }),
  ),
};
await mock.module('@/services/team-member/index.js', () => ({ ...real, teamMemberService: svc }));

afterAll(() => {
  void mock.module('@/services/team-member/index.js', () => real);
});

afterEach(() => {
  mock.clearAllMocks();
});

import type {
  AddBody,
  AddParams,
  AddResponse,
  ListBody,
  ListParams,
  ListResponse,
  RemoveBody,
  RemoveParams,
  RemoveResponse,
} from '@/controllers/team-member/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { ReplyEnvelope } from '@/types/envelope.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const { add } = await import('@/controllers/team-member/add.js');
const { list } = await import('@/controllers/team-member/list.js');
const { remove } = await import('@/controllers/team-member/remove.js');

const params = { id: MISSING_ID };

const runAdd = async (actor: Actor | null, body: AddBody) => {
  const { fake, reply } = makeReply<FastifyReply<{ Reply: ReplyEnvelope<AddResponse> }>>();
  await add(
    makeReq<FastifyRequest<{ Body: AddBody; Params: AddParams }>>({ actor, body, params }),
    reply,
  );
  return fake;
};

const runRemove = async (actor: Actor | null, body: RemoveBody) => {
  const { fake, reply } = makeReply<FastifyReply<{ Reply: ReplyEnvelope<RemoveResponse> }>>();
  await remove(
    makeReq<FastifyRequest<{ Body: RemoveBody; Params: RemoveParams }>>({ actor, body, params }),
    reply,
  );
  return fake;
};

const runList = async (actor: Actor | null, body: ListBody) => {
  const { fake, reply } = makeReply<FastifyReply<{ Reply: ReplyEnvelope<ListResponse> }>>();
  await list(
    makeReq<FastifyRequest<{ Body: ListBody; Params: ListParams }>>({ actor, body, params }),
    reply,
  );
  return fake;
};

const tooMany = Array.from(
  { length: 101 },
  (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
);

describe('team_member.controller.add', () => {
  it('dedupes ids, calls the service and replies with the event', async () => {
    const actor = makeActor('manager');
    const fake = await runAdd(actor, { user_ids: [OTHER_ID, OTHER_ID] });
    expect(svc.add).toHaveBeenCalledWith({ actor, id: MISSING_ID, user_ids: [OTHER_ID] });
    expect(fake.sent).toMatchObject({
      data: { added: [OTHER_ID], failed: [], success: true },
      event: 'team.members.added',
    });
  });

  it('forbids employees before calling the service', async () => {
    const error = await caught(runAdd(makeActor('employee'), { user_ids: [OTHER_ID] }));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.add).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests', async () => {
    const error = await caught(runAdd(null, { user_ids: [OTHER_ID] }));
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('caps the number of ids', async () => {
    const error = await caught(runAdd(makeActor('admin'), { user_ids: tooMany }));
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(svc.add).not.toHaveBeenCalled();
  });

  it('wraps service failures and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.add.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(runAdd(makeActor('admin'), { user_ids: [OTHER_ID] }));
    expect(error.code).toBe('TEAM_MEMBER_ADD_ERROR');
    expect(error.cause).toBe(failure);
    expect(error.metadata['route']).toBe('team_member.controller.add');
  });
});

describe('team_member.controller.remove', () => {
  it('dedupes ids, calls the service and replies with the event', async () => {
    const actor = makeActor('admin');
    const fake = await runRemove(actor, { user_ids: [OTHER_ID, OTHER_ID] });
    expect(svc.remove).toHaveBeenCalledWith({ actor, id: MISSING_ID, user_ids: [OTHER_ID] });
    expect(fake.sent).toMatchObject({
      data: { failed: [], removed: [OTHER_ID], success: true },
      event: 'team.members.removed',
    });
  });

  it('forbids employees before calling the service', async () => {
    const error = await caught(runRemove(makeActor('employee'), { user_ids: [OTHER_ID] }));
    expect(error.code).toBe('FORBIDDEN');
    expect(svc.remove).not.toHaveBeenCalled();
  });

  it('caps the number of ids', async () => {
    const error = await caught(runRemove(makeActor('admin'), { user_ids: tooMany }));
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('wraps service failures and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.remove.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(runRemove(makeActor('admin'), { user_ids: [OTHER_ID] }));
    expect(error.code).toBe('TEAM_MEMBER_REMOVE_ERROR');
    expect(error.cause).toBe(failure);
  });
});

describe('team_member.controller.list', () => {
  it('applies defaults and replies with the event', async () => {
    const actor = makeActor('employee');
    const fake = await runList(actor, {});
    expect(svc.list).toHaveBeenCalledWith({
      actor,
      cursor: undefined,
      id: MISSING_ID,
      limit: 25,
      order: 'desc',
    });
    expect(fake.sent).toMatchObject({
      data: { items: [], more: false, next: null, total: 0 },
      event: 'team.members.listed',
    });
  });

  it('rejects unauthenticated requests', async () => {
    const error = await caught(runList(null, {}));
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('wraps service failures and keeps the cause', async () => {
    const failure = new Error('boom');
    svc.list.mockImplementationOnce(() => Promise.reject(failure));
    const error = await caught(runList(makeActor('admin'), {}));
    expect(error.code).toBe('TEAM_MEMBER_LIST_ERROR');
    expect(error.cause).toBe(failure);
  });
});
