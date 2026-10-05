import { registerError } from '../index.js';

export const ReportInvalidError = registerError({
  code: 'REPORT_INVALID',
  defaultStatus: 400,
  message: 'The report range is invalid.',
});

export const ReportTeamError = registerError({
  code: 'REPORT_TEAM_ERROR',
  defaultStatus: 500,
  message: 'The team report could not be computed.',
});

export const ReportTeamNotFoundError = registerError({
  code: 'REPORT_TEAM_NOT_FOUND',
  defaultStatus: 404,
  message: 'The team does not exist.',
});

export const ReportUserError = registerError({
  code: 'REPORT_USER_ERROR',
  defaultStatus: 500,
  message: 'The user report could not be computed.',
});
