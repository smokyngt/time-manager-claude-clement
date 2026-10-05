import { registerEvent } from '../index.js';

export const AuthLoggedIn = registerEvent<{ user_id: string }>('auth.logged_in');

export const AuthLoggedOut = registerEvent<{ user_id: string }>('auth.logged_out');

export const AuthMicrosoftLinked = registerEvent<{ user_id: string }>('auth.microsoft_linked');

export const AuthMicrosoftStarted = registerEvent<Record<string, never>>('auth.microsoft_started');

export const AuthRefreshed = registerEvent<{ user_id: string }>('auth.refreshed');

export const AuthRetrieved = registerEvent<{ user_id: string }>('auth.retrieved');
