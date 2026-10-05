import { registerError } from '../base/registry.js';

export const TeamMemberAddError = registerError({
  code: 'team.member.add.failed',
  defaultStatus: 500,
});

export const TeamMemberListError = registerError({
  code: 'team.member.list.failed',
  defaultStatus: 500,
});

export const TeamMemberNotFoundError = registerError({
  code: 'team.member.not.found',
  defaultStatus: 404,
});

export const TeamMemberRemoveError = registerError({
  code: 'team.member.remove.failed',
  defaultStatus: 500,
});

export const TeamMemberTeamArchivedError = registerError({
  code: 'team.member.team.archived',
  defaultStatus: 409,
});

export const TeamMemberTeamNotFoundError = registerError({
  code: 'team.member.team.not.found',
  defaultStatus: 404,
});

export const TeamMemberUserArchivedError = registerError({
  code: 'team.member.user.archived',
  defaultStatus: 409,
});

export const TeamMemberUserNotFoundError = registerError({
  code: 'team.member.user.not.found',
  defaultStatus: 404,
});
