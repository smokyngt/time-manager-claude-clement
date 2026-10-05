import { mock } from 'bun:test';

export const installMembership = async () => {
  const real = { ...(await import('@/utils/membership.js')) };
  const managed = new Set<string>();
  const teamed = new Set<string>();
  const Membership = {
    manages: mock((_actor: unknown, userId: string) => Promise.resolve(managed.has(userId))),
    members: mock(() => Promise.resolve([] as string[])),
    reaches: mock(() => Promise.resolve(false)),
    teams: mock((userId: string) => Promise.resolve(teamed.has(userId) ? ['team'] : [])),
  };
  await mock.module('@/utils/membership.js', () => ({ ...real, Membership }));
  return {
    managed,
    restore: (): void => {
      void mock.module('@/utils/membership.js', () => real);
    },
    teamed,
  };
};
