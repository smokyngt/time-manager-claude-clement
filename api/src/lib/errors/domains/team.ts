import { registerError } from '@/lib/errors/base/registry.js';

export const TeamArchiveError = registerError({ code: 'team.archive.failed', defaultStatus: 500 });

export const TeamCreateError = registerError({ code: 'team.create.failed', defaultStatus: 500 });

export const TeamDeleteError = registerError({ code: 'team.delete.failed', defaultStatus: 500 });

export const TeamListError = registerError({ code: 'team.list.failed', defaultStatus: 500 });

export const TeamManagerInvalidError = registerError({ code: 'team.manager.invalid', defaultStatus: 400 });

export const TeamNotFoundError = registerError({ code: 'team.not.found', defaultStatus: 404 });

export const TeamRestoreError = registerError({ code: 'team.restore.failed', defaultStatus: 500 });

export const TeamRetrieveError = registerError({ code: 'team.retrieve.failed', defaultStatus: 500 });

export const TeamScheduleInvalidError = registerError({ code: 'team.schedule.invalid', defaultStatus: 400 });

export const TeamUpdateError = registerError({ code: 'team.update.failed', defaultStatus: 500 });
