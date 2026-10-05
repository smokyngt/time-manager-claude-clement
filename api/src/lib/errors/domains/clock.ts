import { registerError } from '@/lib/errors/base/registry.js';

export const ClockConflictError = registerError({ code: 'clock.conflict', defaultStatus: 409 });

export const ClockCreateError = registerError({ code: 'clock.create.failed', defaultStatus: 500 });

export const ClockCurrentError = registerError({ code: 'clock.current.failed', defaultStatus: 500 });

export const ClockDeleteError = registerError({ code: 'clock.delete.failed', defaultStatus: 500 });

export const ClockInError = registerError({ code: 'clock.in.failed', defaultStatus: 500 });

export const ClockInvalidError = registerError({ code: 'clock.invalid', defaultStatus: 400 });

export const ClockListError = registerError({ code: 'clock.list.failed', defaultStatus: 500 });

export const ClockNotFoundError = registerError({ code: 'clock.not.found', defaultStatus: 404 });

export const ClockOutError = registerError({ code: 'clock.out.failed', defaultStatus: 500 });

export const ClockOverlapError = registerError({ code: 'clock.overlap', defaultStatus: 409 });

export const ClockRetrieveError = registerError({ code: 'clock.retrieve.failed', defaultStatus: 500 });

export const ClockUpdateError = registerError({ code: 'clock.update.failed', defaultStatus: 500 });
