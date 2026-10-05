import { mock } from 'bun:test';

export const installMembership = async () => {
  const real = { ...(await import('@/utils/membership.js')) };
  const teams = mock((_userId: string) => Promise.resolve([] as string[]));
  await mock.module('@/utils/membership.js', () => ({
    ...real,
    Membership: {
      manages: (...args: Parameters<typeof real.Membership.manages>) =>
        real.Membership.manages(...args),
      members: (...args: Parameters<typeof real.Membership.members>) =>
        real.Membership.members(...args),
      reaches: (...args: Parameters<typeof real.Membership.reaches>) =>
        real.Membership.reaches(...args),
      teams,
    },
  }));
  return {
    restore: (): void => {
      void mock.module('@/utils/membership.js', () => real);
    },
    teams,
  };
};
