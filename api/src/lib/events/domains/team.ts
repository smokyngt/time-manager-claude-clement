import { registerEvent } from '../index.js';

export const TeamArchived = registerEvent<{ team_id: string }>('team.archived');

export const TeamCreated = registerEvent<{ team_id: string }>('team.created');

export const TeamDeleted = registerEvent<{ deleted: number; failed: number }>('team.deleted');

export const TeamListed = registerEvent<{ count: number; total: number }>('team.listed');

export const TeamRestored = registerEvent<{ team_id: string }>('team.restored');

export const TeamRetrieved = registerEvent<{ team_id: string }>('team.retrieved');

export const TeamUpdated = registerEvent<{ failed: number; updated: number }>('team.updated');
