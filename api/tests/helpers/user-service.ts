import { mock } from 'bun:test';

import { UserNotFoundError } from '@/lib/errors/domains/user.js';
import { UserMapper } from '@/utils/user-mapper.js';

import { makeRow } from './fixtures.js';

import type { ListParams, UserCreateData, UserUpdateData } from '@/services/user/index.js';
import type { Actor } from '@/types/entities/actor.js';
import type { Role, User } from '@/types/entities/user.js';

export const makeUser = (role: Role, id: string, overrides: Partial<User> = {}): User => ({
  ...UserMapper.entity(makeRow({ id, role })),
  ...overrides,
});

export const installUserService = async () => {
  const real = { ...(await import('@/services/user/index.js')) };
  const directory = new Map<string, User>();
  const find = (id: string): User => {
    const user = directory.get(id);
    if (user === undefined) throw UserNotFoundError();
    return user;
  };
  const svc = {
    archive: mock((params: { actor: Actor; id: string }) =>
      Promise.resolve({ user: { ...find(params.id), archived_at: 1 } }),
    ),
    create: mock((params: { actor: Actor; data: UserCreateData }) =>
      Promise.resolve({
        user: makeUser(params.data.role ?? 'employee', '00000000-0000-4000-8000-0000000000d1'),
      }),
    ),
    delete: mock((params: { actor: Actor; id: string }) => {
      find(params.id);
      return Promise.resolve({ success: true });
    }),
    list: mock((_params: ListParams) =>
      Promise.resolve({ items: [] as User[], more: false, next: null, total: 0 }),
    ),
    restore: mock((params: { actor: Actor; id: string }) =>
      Promise.resolve({ user: find(params.id) }),
    ),
    retrieve: mock((params: { id: string }) =>
      Promise.resolve().then(() => ({ user: find(params.id) })),
    ),
    update: mock((params: { actor: Actor; data: UserUpdateData; id: string }) =>
      Promise.resolve({ user: find(params.id) }),
    ),
  };
  await mock.module('@/services/user/index.js', () => ({ ...real, userService: svc }));
  return {
    directory,
    restore: (): void => {
      void mock.module('@/services/user/index.js', () => real);
    },
    svc,
  };
};
