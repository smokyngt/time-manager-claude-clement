import { registerError } from '../index.js';

export const AuthInvalidCredentialsError = registerError({
  code: 'AUTH_INVALID_CREDENTIALS',
  defaultStatus: 401,
  message: 'The email or password is incorrect.',
});

export const AuthLoginError = registerError({
  code: 'AUTH_LOGIN_ERROR',
  defaultStatus: 500,
  message: 'The login could not be completed.',
});

export const AuthLogoutError = registerError({
  code: 'AUTH_LOGOUT_ERROR',
  defaultStatus: 500,
  message: 'The logout could not be completed.',
});

export const AuthMeError = registerError({
  code: 'AUTH_ME_ERROR',
  defaultStatus: 500,
  message: 'The current user could not be retrieved.',
});

export const AuthMicrosoftError = registerError({
  code: 'AUTH_MICROSOFT_ERROR',
  defaultStatus: 500,
  message: 'The Microsoft sign-in could not be completed.',
});

export const AuthMicrosoftRejectedError = registerError({
  code: 'AUTH_MICROSOFT_REJECTED',
  defaultStatus: 401,
  message: 'The Microsoft sign-in was rejected.',
});

export const AuthMicrosoftUnavailableError = registerError({
  code: 'AUTH_MICROSOFT_UNAVAILABLE',
  defaultStatus: 503,
  message: 'Microsoft sign-in is not configured on this server.',
});

export const AuthMicrosoftUnknownUserError = registerError({
  code: 'AUTH_MICROSOFT_UNKNOWN_USER',
  defaultStatus: 403,
  message: 'No account matches this Microsoft identity. Ask a manager to create your account.',
});

export const AuthRefreshError = registerError({
  code: 'AUTH_REFRESH_ERROR',
  defaultStatus: 500,
  message: 'The session could not be refreshed.',
});

export const AuthSessionInvalidError = registerError({
  code: 'AUTH_SESSION_INVALID',
  defaultStatus: 401,
  message: 'The session is invalid or has expired.',
});
