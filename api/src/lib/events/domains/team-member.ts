import { registerEvent } from '../base/registry.js';

export type TeamMembersAddedPayload = {
  actor: string;
  added: number;
  failed: number;
  team_id: string;
};

export type TeamMembersListedPayload = {
  actor: string;
  count: number;
  team_id: string;
  total: number;
};

export type TeamMembersRemovedPayload = {
  actor: string;
  failed: number;
  removed: number;
  team_id: string;
};

export const TeamMembersAdded = registerEvent<TeamMembersAddedPayload>({
  code: 'team.members.added',
});

export const TeamMembersListed = registerEvent<TeamMembersListedPayload>({
  code: 'team.members.listed',
});

export const TeamMembersRemoved = registerEvent<TeamMembersRemovedPayload>({
  code: 'team.members.removed',
});
