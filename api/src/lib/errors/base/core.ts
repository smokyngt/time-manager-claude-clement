import { registerError } from './registry.js';

export const ValidationError = registerError({ code: 'validation.error', defaultStatus: 400 });

export const InvalidJsonError = registerError({ code: 'json.invalid', defaultStatus: 400 });

export const TokenAuthenticationError = registerError({
  code: 'token.authentication.failed',
  defaultStatus: 401,
});

export const UnauthorizedError = registerError({ code: 'unauthorized', defaultStatus: 403 });

export const NotFoundError = registerError({ code: 'route.not.found', defaultStatus: 404 });

export const DuplicateKeyError = registerError({ code: 'duplicate.key', defaultStatus: 409 });

export const PayloadTooLargeError = registerError({
  code: 'payload.too.large',
  defaultStatus: 413,
});

export const RateLimitError = registerError({ code: 'rate.limit.exceeded', defaultStatus: 429 });

export const InternalError = registerError({ code: 'internal.unexpected', defaultStatus: 500 });
