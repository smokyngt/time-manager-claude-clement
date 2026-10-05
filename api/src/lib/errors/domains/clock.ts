import { registerError } from '../index.js';

export const ClockConflictError = registerError({
  code: 'CLOCK_CONFLICT',
  defaultStatus: 409,
  message: 'The clock state does not allow this action.',
});

export const ClockCreateError = registerError({
  code: 'CLOCK_CREATE_ERROR',
  defaultStatus: 500,
  message: 'The clock could not be created.',
});

export const ClockCurrentError = registerError({
  code: 'CLOCK_CURRENT_ERROR',
  defaultStatus: 500,
  message: 'The current clock could not be retrieved.',
});

export const ClockDeleteError = registerError({
  code: 'CLOCK_DELETE_ERROR',
  defaultStatus: 500,
  message: 'The clock could not be deleted.',
});

export const ClockInError = registerError({
  code: 'CLOCK_IN_ERROR',
  defaultStatus: 500,
  message: 'The clock-in could not be recorded.',
});

export const ClockInvalidError = registerError({
  code: 'CLOCK_INVALID',
  defaultStatus: 400,
  message: 'The clock timestamps are invalid.',
});

export const ClockListError = registerError({
  code: 'CLOCK_LIST_ERROR',
  defaultStatus: 500,
  message: 'The clocks could not be listed.',
});

export const ClockNotFoundError = registerError({
  code: 'CLOCK_NOT_FOUND',
  defaultStatus: 404,
  message: 'The clock does not exist.',
});

export const ClockOutError = registerError({
  code: 'CLOCK_OUT_ERROR',
  defaultStatus: 500,
  message: 'The clock-out could not be recorded.',
});

export const ClockOverlapError = registerError({
  code: 'CLOCK_OVERLAP',
  defaultStatus: 409,
  message: 'The clock overlaps another clock of the same user.',
});

export const ClockRetrieveError = registerError({
  code: 'CLOCK_RETRIEVE_ERROR',
  defaultStatus: 500,
  message: 'The clock could not be retrieved.',
});

export const ClockUpdateError = registerError({
  code: 'CLOCK_UPDATE_ERROR',
  defaultStatus: 500,
  message: 'The clock could not be updated.',
});
