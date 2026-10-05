import { registerError } from '../index.js';

export const UserArchiveError = registerError({
  code: 'USER_ARCHIVE_ERROR',
  defaultStatus: 500,
  message: 'The user could not be archived.',
});

export const UserConflictError = registerError({
  code: 'USER_CONFLICT',
  defaultStatus: 409,
  message: 'A user with this email already exists.',
});

export const UserCreateError = registerError({
  code: 'USER_CREATE_ERROR',
  defaultStatus: 500,
  message: 'The user could not be created.',
});

export const UserDeleteError = registerError({
  code: 'USER_DELETE_ERROR',
  defaultStatus: 500,
  message: 'The user could not be deleted.',
});

export const UserListError = registerError({
  code: 'USER_LIST_ERROR',
  defaultStatus: 500,
  message: 'The users could not be listed.',
});

export const UserNotFoundError = registerError({
  code: 'USER_NOT_FOUND',
  defaultStatus: 404,
  message: 'The user does not exist.',
});

export const UserPasswordInvalidError = registerError({
  code: 'USER_PASSWORD_INVALID',
  defaultStatus: 403,
  message: 'The current password is missing or incorrect.',
});

export const UserRestoreError = registerError({
  code: 'USER_RESTORE_ERROR',
  defaultStatus: 500,
  message: 'The user could not be restored.',
});

export const UserRetrieveError = registerError({
  code: 'USER_RETRIEVE_ERROR',
  defaultStatus: 500,
  message: 'The user could not be retrieved.',
});

export const UserUpdateError = registerError({
  code: 'USER_UPDATE_ERROR',
  defaultStatus: 500,
  message: 'The user could not be updated.',
});
