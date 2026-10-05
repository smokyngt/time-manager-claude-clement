import { registerEvent } from '@/lib/events/base/registry.js';

export const ClockCreated = registerEvent<{ actor: string; clock_id: string }>({ code: 'clock.created' });

export const ClockCurrentRetrieved = registerEvent<{ actor: string; open: boolean }>({
  code: 'clock.current.retrieved',
});

export const ClockDeleted = registerEvent<{ actor: string; deleted: number; failed: number }>({ code: 'clock.deleted' });

export const ClockListed = registerEvent<{ actor: string; count: number; total: number }>({ code: 'clock.listed' });

export const ClockRetrieved = registerEvent<{ actor: string; clock_id: string }>({ code: 'clock.retrieved' });

export const ClockStarted = registerEvent<{ actor: string; clock_id: string }>({ code: 'clock.started' });

export const ClockStopped = registerEvent<{ actor: string; clock_id: string }>({ code: 'clock.stopped' });

export const ClockUpdated = registerEvent<{ actor: string; failed: number; updated: number }>({ code: 'clock.updated' });
