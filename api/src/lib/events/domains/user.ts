import { registerEvent } from '../index.js';

export const UserArchived = registerEvent<{ user_id: string }>('user.archived');

export const UserCreated = registerEvent<{ user_id: string }>('user.created');

export const UserDeleted = registerEvent<{ deleted: number; failed: number }>('user.deleted');

export const UserListed = registerEvent<{ count: number; total: number }>('user.listed');

export const UserRestored = registerEvent<{ user_id: string }>('user.restored');

export const UserRetrieved = registerEvent<{ user_id: string }>('user.retrieved');

export const UserUpdated = registerEvent<{ failed: number; updated: number }>('user.updated');
