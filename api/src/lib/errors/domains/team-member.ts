import { registerError } from '../index.js';

export const TeamMemberAddError = registerError({
  code: 'TEAM_MEMBER_ADD_ERROR',
  defaultStatus: 500,
  message: 'The team members could not be added.',
});

export const TeamMemberListError = registerError({
  code: 'TEAM_MEMBER_LIST_ERROR',
  defaultStatus: 500,
  message: 'The team members could not be listed.',
});

export const TeamMemberNotFoundError = registerError({
  code: 'TEAM_MEMBER_NOT_FOUND',
  defaultStatus: 404,
  message: 'The user is not a member of this team.',
});

export const TeamMemberRemoveError = registerError({
  code: 'TEAM_MEMBER_REMOVE_ERROR',
  defaultStatus: 500,
  message: 'The team members could not be removed.',
});

export const TeamMemberTeamArchivedError = registerError({
  code: 'TEAM_MEMBER_TEAM_ARCHIVED',
  defaultStatus: 409,
  message: 'The team is archived.',
});

export const TeamMemberTeamNotFoundError = registerError({
  code: 'TEAM_MEMBER_TEAM_NOT_FOUND',
  defaultStatus: 404,
  message: 'The team does not exist.',
});

export const TeamMemberUserArchivedError = registerError({
  code: 'TEAM_MEMBER_USER_ARCHIVED',
  defaultStatus: 409,
  message: 'The user is archived.',
});

export const TeamMemberUserNotFoundError = registerError({
  code: 'TEAM_MEMBER_USER_NOT_FOUND',
  defaultStatus: 404,
  message: 'The user does not exist.',
});
