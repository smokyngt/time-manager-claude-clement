import { mock } from 'bun:test';

import { ClockNotFoundError } from '@/lib/errors/domains/clock.js';

import type { ClockCreateData, ClockUpdateData, ListClocksParams } from '@/services/clock/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { Clock } from '@/types/entities/clock.js';

export const installClockService = async () => {
  const real = { ...(await import('@/services/clock/index.js')) };
  const directory = new Map<string, Clock>();
  const find = (id: string): Clock => {
    const clock = directory.get(id);
    if (clock === undefined) throw ClockNotFoundError({ metadata: { route: 'test' } });

    return clock;
  };
  const sample = (userId: string, overrides: Partial<Clock> = {}): Clock => ({
    clocked_in_at: 1_700_000_000_000,
    clocked_out_at: null,
    created_at: 1_700_000_000_000,
    duration_ms: null,
    id: '00000000-0000-4000-8000-0000000000f9',
    note: null,
    object: 'clock',
    source: 'clock',
    updated_at: null,
    user_id: userId,
    ...overrides,
  });
  const svc = {
    clockIn: mock((params: { actor: Actor; note?: string }) =>
      Promise.resolve({ clock: sample(params.actor.id) }),
    ),
    clockOut: mock((params: { actor: Actor; note?: string }) =>
      Promise.resolve({ clock: sample(params.actor.id, { clocked_out_at: 1_700_028_800_000 }) }),
    ),
    create: mock((params: { actor: Actor; data: ClockCreateData }) =>
      Promise.resolve({ clock: sample(params.data.user_id, { source: 'manual' }) }),
    ),
    current: mock((_params: { actor: Actor }) =>
      Promise.resolve({ clock: null as Clock | null }),
    ),
    delete: mock((params: { actor: Actor; id: string }) => {
      find(params.id);

      return Promise.resolve({ success: true });
    }),
    list: mock((_params: ListClocksParams) =>
      Promise.resolve({ items: [] as Clock[], more: false, next: null, total: 0 }),
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
    sample,
    svc,
  };
};

export const installMembership = async () => {
  const real = { ...(await import('@/utils/membership.js')) };
  const managed = new Set<string>();
  const Membership = {
    manages: mock((_actor: unknown, userId: string) => Promise.resolve(managed.has(userId))),
    members: mock((_managerId: string) => Promise.resolve([...managed])),
  };
  await mock.module('@/utils/membership.js', () => ({ ...real, Membership }));

  return {
    managed,
    restore: (): void => {
      void mock.module('@/utils/membership.js', () => real);
    },
  };
};
