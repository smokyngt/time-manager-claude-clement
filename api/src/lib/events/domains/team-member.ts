import { registerEvent } from '../index.js';

export const TeamMembersAdded = registerEvent<{ added: number; failed: number }>(
  'team.members.added',
);

export const TeamMembersListed = registerEvent<{ count: number; total: number }>(
  'team.members.listed',
);

export const TeamMembersRemoved = registerEvent<{ failed: number; removed: number }>(
  'team.members.removed',
);
