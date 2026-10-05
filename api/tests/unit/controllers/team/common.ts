import { mock } from 'bun:test';

export const installMembership = async () => {
  const real = { ...(await import('@/utils/membership.js')) };
  const teams = mock((_userId: string) => Promise.resolve([] as string[]));
  await mock.module('@/utils/membership.js', () => ({
    ...real,
    Membership: { ...real.Membership, teams },
  }));
  return {
    restore: (): void => {
      void mock.module('@/utils/membership.js', () => real);
    },
    teams,
  };
};
