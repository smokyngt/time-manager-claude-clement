import { registerError } from '../base/registry.js';

export const ReportInvalidError = registerError({ code: 'report.invalid', defaultStatus: 400 });

export const ReportTeamError = registerError({ code: 'report.team.failed', defaultStatus: 500 });

export const ReportTeamNotFoundError = registerError({
  code: 'report.team.not.found',
  defaultStatus: 404,
});

export const ReportUserError = registerError({ code: 'report.user.failed', defaultStatus: 500 });

export const ReportUserNotFoundError = registerError({
  code: 'report.user.not.found',
  defaultStatus: 404,
});
