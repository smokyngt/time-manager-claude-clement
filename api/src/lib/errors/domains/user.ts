import { registerError } from '@/lib/errors/base/registry.js';

export const UserArchiveError = registerError({ code: 'user.archive.failed', defaultStatus: 500 });

export const UserCreateError = registerError({ code: 'user.create.failed', defaultStatus: 500 });

export const UserDeleteError = registerError({ code: 'user.delete.failed', defaultStatus: 500 });

export const UserListError = registerError({ code: 'user.list.failed', defaultStatus: 500 });

export const UserNotFoundError = registerError({ code: 'user.not.found', defaultStatus: 404 });

export const UserPasswordInvalidError = registerError({ code: 'user.password.invalid', defaultStatus: 403 });

export const UserRestoreError = registerError({ code: 'user.restore.failed', defaultStatus: 500 });

export const UserRetrieveError = registerError({ code: 'user.retrieve.failed', defaultStatus: 500 });

export const UserUpdateError = registerError({ code: 'user.update.failed', defaultStatus: 500 });
