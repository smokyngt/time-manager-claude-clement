import { registerError } from '@/lib/errors/base/registry.js';

export const AuthCredentialsInvalidError = registerError({
  code: 'auth.credentials.invalid',
  defaultStatus: 401,
});

export const AuthLoginError = registerError({ code: 'auth.login.failed', defaultStatus: 500 });

export const AuthLogoutError = registerError({ code: 'auth.logout.failed', defaultStatus: 500 });

export const AuthMeError = registerError({ code: 'auth.me.failed', defaultStatus: 500 });

export const AuthMicrosoftError = registerError({
  code: 'auth.microsoft.failed',
  defaultStatus: 500,
});

export const AuthMicrosoftRejectedError = registerError({
  code: 'auth.microsoft.rejected',
  defaultStatus: 401,
});

export const AuthMicrosoftUnavailableError = registerError({
  code: 'auth.microsoft.unavailable',
  defaultStatus: 503,
});

export const AuthMicrosoftUnknownUserError = registerError({
  code: 'auth.microsoft.unknown.user',
  defaultStatus: 403,
});

export const AuthRateLimitedError = registerError({
  code: 'auth.rate.limited',
  defaultStatus: 429,
});

export const AuthRefreshError = registerError({ code: 'auth.refresh.failed', defaultStatus: 500 });

export const AuthRefreshInvalidError = registerError({
  code: 'auth.refresh.invalid',
  defaultStatus: 401,
});
