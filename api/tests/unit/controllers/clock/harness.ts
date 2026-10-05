import { mock } from 'bun:test';

import { ClockNotFoundError } from '@/lib/errors/domains/clock.js';
import { ClockMapper } from '@/utils/clock-mapper.js';

import { makeClockRow } from '../../services/clock/fixtures.js';

import type { ClockCreateData, ClockUpdateData, ListParams } from '@/services/clock/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { Clock } from '@/types/entities/clock.js';

export const makeClock = (id: string, userId: string, overrides: Partial<Clock> = {}): Clock => ({
  ...ClockMapper.entity(makeClockRow({ id, user_id: userId })),
  ...overrides,
});

export const installClockService = async () => {
  const real = { ...(await import('@/services/clock/index.js')) };
  const directory = new Map<string, Clock>();
  const find = (id: string): Clock => {
    const clock = directory.get(id);
    if (clock === undefined) throw ClockNotFoundError();
    return clock;
  };
  const svc = {
    create: mock((params: { actor: Actor; data: ClockCreateData }) =>
      Promise.resolve({
        clock: makeClock('00000000-0000-4000-8000-0000000000d1', params.data.user_id, {
          source: 'manual',
        }),
      }),
    ),
    current: mock((_params: { actor: Actor }) => Promise.resolve({ clock: null as Clock | null })),
    delete: mock((params: { actor: Actor; id: string }) => {
      find(params.id);
      return Promise.resolve({ success: true });
    }),
    in: mock((params: { actor: Actor; note?: string }) =>
      Promise.resolve({
        clock: makeClock('00000000-0000-4000-8000-0000000000d2', params.actor.id, {
          clocked_out_at: null,
          duration_ms: null,
        }),
      }),
    ),
    list: mock((_params: ListParams) =>
      Promise.resolve({ items: [] as Clock[], more: false, next: null, total: 0 }),
    ),
    out: mock((params: { actor: Actor; note?: string }) =>
      Promise.resolve({
        clock: makeClock('00000000-0000-4000-8000-0000000000d2', params.actor.id),
      }),
    ),
    retrieve: mock((params: { id: string }) =>
      Promise.resolve().then(() => ({ clock: find(params.id) })),
    ),
    update: mock((params: { actor: Actor; data: ClockUpdateData; id: string }) =>
      Promise.resolve({ clock: find(params.id) }),
    ),
  };
  await mock.module('@/services/clock/index.js', () => ({ ...real, clockService: svc }));
  return {
    directory,
    restore: (): void => {
      void mock.module('@/services/clock/index.js', () => real);
    },
    svc,
  };
};

export const installMembership = async () => {
  const real = { ...(await import('@/utils/membership.js')) };
  const managed = new Set<string>();
  const stub = {
    manages: mock((actor: Actor, userId: string) =>
      Promise.resolve(actor.role === 'admin' || (actor.role === 'manager' && managed.has(userId))),
    ),
    members: mock((_managerId: string) => Promise.resolve([...managed])),
    reaches: mock((actor: Actor, userId: string) =>
      Promise.resolve(actor.id === userId || managed.has(userId)),
    ),
    teams: mock((_userId: string) => Promise.resolve([] as string[])),
  };
  await mock.module('@/utils/membership.js', () => ({
    ...real,
    Membership: stub,
  }));
  return {
    managed,
    restore: (): void => {
      void mock.module('@/utils/membership.js', () => real);
    },
    stub,
  };
};
