import { registerError } from '../index.js';

export const TeamArchiveError = registerError({
  code: 'TEAM_ARCHIVE_ERROR',
  defaultStatus: 500,
  message: 'The team could not be archived.',
});

export const TeamCreateError = registerError({
  code: 'TEAM_CREATE_ERROR',
  defaultStatus: 500,
  message: 'The team could not be created.',
});

export const TeamDeleteError = registerError({
  code: 'TEAM_DELETE_ERROR',
  defaultStatus: 500,
  message: 'The team could not be deleted.',
});

export const TeamListError = registerError({
  code: 'TEAM_LIST_ERROR',
  defaultStatus: 500,
  message: 'The teams could not be listed.',
});

export const TeamManagerInvalidError = registerError({
  code: 'TEAM_MANAGER_INVALID',
  defaultStatus: 400,
  message: 'The manager must be an active user with the manager or admin role.',
});

export const TeamNotFoundError = registerError({
  code: 'TEAM_NOT_FOUND',
  defaultStatus: 404,
  message: 'The team does not exist.',
});

export const TeamRestoreError = registerError({
  code: 'TEAM_RESTORE_ERROR',
  defaultStatus: 500,
  message: 'The team could not be restored.',
});

export const TeamRetrieveError = registerError({
  code: 'TEAM_RETRIEVE_ERROR',
  defaultStatus: 500,
  message: 'The team could not be retrieved.',
});

export const TeamScheduleInvalidError = registerError({
  code: 'TEAM_SCHEDULE_INVALID',
  defaultStatus: 400,
  message: 'The end of the working day must be after its start.',
});

export const TeamUpdateError = registerError({
  code: 'TEAM_UPDATE_ERROR',
  defaultStatus: 500,
  message: 'The team could not be updated.',
});
