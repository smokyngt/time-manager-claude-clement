import { registerError } from '../index.js';

export const LogCreateError = registerError({
  code: 'LOG_CREATE_ERROR',
  defaultStatus: 500,
  message: 'The audit log entry could not be created.',
});
