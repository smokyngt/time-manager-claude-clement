import { registerEvent } from '@/lib/events/base/registry.js';

export const UserArchived = registerEvent<{ actor: string; user_id: string }>({ code: 'user.archived' });

export const UserCreated = registerEvent<{ actor: string; user_id: string }>({ code: 'user.created' });

export const UserDeleted = registerEvent<{ actor: string; deleted: number; failed: number }>({ code: 'user.deleted' });

export const UserListed = registerEvent<{ actor: string; count: number; total: number }>({ code: 'user.listed' });

export const UserRestored = registerEvent<{ actor: string; user_id: string }>({ code: 'user.restored' });

export const UserRetrieved = registerEvent<{ actor: string; user_id: string }>({ code: 'user.retrieved' });

export const UserUpdated = registerEvent<{ actor: string; failed: number; updated: number }>({ code: 'user.updated' });
