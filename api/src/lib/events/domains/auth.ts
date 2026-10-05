import { registerEvent } from '@/lib/events/base/registry.js';

export type EmptyPayload = Record<string, never>;

export const AuthLoggedIn = registerEvent<{ actor: string }>({ code: 'auth.logged_in' });

export const AuthLoggedOut = registerEvent<{ actor?: string }>({ code: 'auth.logged_out' });

export const AuthMicrosoftLinked = registerEvent<{ actor: string }>({
  code: 'auth.microsoft_linked',
});

export const AuthMicrosoftStarted = registerEvent<EmptyPayload>({
  code: 'auth.microsoft_started',
});

export const AuthRefreshed = registerEvent<{ actor: string }>({ code: 'auth.refreshed' });

export const AuthRefreshReused = registerEvent<{ actor: string; family_id: string }>({
  code: 'auth.refresh_reuse_detected',
});

export const AuthRetrieved = registerEvent<{ actor: string }>({ code: 'auth.retrieved' });
