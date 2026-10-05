import { registerEvent } from '../index.js';

export const ClockCreated = registerEvent<{ clock_id: string }>('clock.created');

export const ClockCurrent = registerEvent<{ open: boolean }>('clock.current');

export const ClockDeleted = registerEvent<{ deleted: number; failed: number }>('clock.deleted');

export const ClockIn = registerEvent<{ clock_id: string }>('clock.in');

export const ClockListed = registerEvent<{ count: number; total: number }>('clock.listed');

export const ClockOut = registerEvent<{ clock_id: string }>('clock.out');

export const ClockRetrieved = registerEvent<{ clock_id: string }>('clock.retrieved');

export const ClockUpdated = registerEvent<{ failed: number; updated: number }>('clock.updated');
