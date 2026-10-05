import { registerEvent } from '@/lib/events/base/registry.js';

export const TeamArchived = registerEvent<{ actor: string; team_id: string }>({ code: 'team.archived' });

export const TeamCreated = registerEvent<{ actor: string; team_id: string }>({ code: 'team.created' });

export const TeamDeleted = registerEvent<{ actor: string; deleted: number; failed: number }>({ code: 'team.deleted' });

export const TeamListed = registerEvent<{ actor: string; count: number; total: number }>({ code: 'team.listed' });

export const TeamRestored = registerEvent<{ actor: string; team_id: string }>({ code: 'team.restored' });

export const TeamRetrieved = registerEvent<{ actor: string; team_id: string }>({ code: 'team.retrieved' });

export const TeamUpdated = registerEvent<{ actor: string; failed: number; updated: number }>({ code: 'team.updated' });
