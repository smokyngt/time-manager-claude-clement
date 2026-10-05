import { SCOPES } from '@/config/auth/scopes.js';
import { InternalError } from '@/lib/errors/index.js';
import {
  AuthCredentialsInvalidError,
  AuthMicrosoftUnavailableError,
  AuthRateLimitedError,
  AuthRefreshInvalidError,
} from '@/lib/errors/index.js';
import {
  ErrorSchema,
  RateLimitErrorSchema,
  ReplyEnvelopeSchema,
  TokenAuthenticationErrorSchema,
  ValidationErrorSchema,
} from '@/schemas/base/envelope.js';

import { UserSchema } from './user.js';

import type { JsonSchema } from './common.js';

export const AuthLoginBodySchema = {
  additionalProperties: false,
  properties: {
    email: {
      description: 'Account email address.',
      example: 'jane.doe@example.com',
      format: 'email',
      maxLength: 254,
      type: 'string',
    },
    password: {
      description: 'Account password.',
      example: 'correct-horse-battery',
      maxLength: 128,
      minLength: 1,
      type: 'string',
    },
  },
  required: ['email', 'password'],
  type: 'object',
} as const;

export const AuthSessionDataSchema = {
  additionalProperties: false,
  properties: {
    access_token: {
      description: 'Short-lived JWT to send as a Bearer token. Keep it in memory.',
      example: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature',
      type: 'string',
    },
    expires_in: { description: 'Access token lifetime in seconds.', example: 900, type: 'integer' },
    scopes: {
      description: 'Scopes granted to the user by the current role.',
      example: ['auth:self', 'clocks:read'],
      items: { enum: SCOPES, type: 'string' },
      type: 'array',
    },
    token_type: { description: 'Token type.', enum: ['Bearer'], example: 'Bearer', type: 'string' },
    user: UserSchema,
  },
  required: ['access_token', 'expires_in', 'scopes', 'token_type', 'user'],
  type: 'object',
} as const;

export const AuthLogoutDataSchema = {
  additionalProperties: false,
  properties: {
    success: { description: 'True when the session was closed.', example: true, type: 'boolean' },
  },
  required: ['success'],
  type: 'object',
} as const;

export const AuthMeDataSchema = {
  additionalProperties: false,
  properties: {
    scopes: AuthSessionDataSchema.properties.scopes,
    user: UserSchema,
  },
  required: ['scopes', 'user'],
  type: 'object',
} as const;

export const AuthCallbackQuerySchema = {
  additionalProperties: false,
  properties: {
    code: {
      description: 'Authorization code issued by Microsoft.',
      maxLength: 4096,
      minLength: 1,
      type: 'string',
    },
    error: {
      description: 'Error code sent by Microsoft when the user refused.',
      maxLength: 200,
      type: 'string',
    },
    error_description: {
      description: 'Error details sent by Microsoft.',
      maxLength: 2000,
      type: 'string',
    },
    session_state: {
      description: 'Session identifier sent by Microsoft, ignored.',
      maxLength: 200,
      type: 'string',
    },
    state: {
      description: 'State echoed back by Microsoft.',
      maxLength: 200,
      minLength: 1,
      type: 'string',
    },
  },
  type: 'object',
} as const;

const content = (schema: JsonSchema, description: string): JsonSchema => ({
  content: { 'application/json': { schema } },
  description,
});

const validation = content(ValidationErrorSchema, 'Invalid request.');
const unauthenticated = content(TokenAuthenticationErrorSchema, 'Missing or invalid access token.');
const limited = content(RateLimitErrorSchema, 'Rate limit exceeded.');
const unexpected = content(ErrorSchema(InternalError), 'Unexpected error.');
const unavailable = content(
  ErrorSchema(AuthMicrosoftUnavailableError),
  'Microsoft sign-in is not configured.',
);

export const AuthResponses = {
  callback: {
    302: { description: 'Redirect to the web application, which then calls the refresh endpoint.' },
    429: limited,
    500: unexpected,
    503: unavailable,
  },
  login: {
    200: content(ReplyEnvelopeSchema(AuthSessionDataSchema, 'auth.logged_in'), 'The session.'),
    400: validation,
    401: content(ErrorSchema(AuthCredentialsInvalidError), 'Invalid credentials.'),
    429: content(
      { anyOf: [RateLimitErrorSchema, ErrorSchema(AuthRateLimitedError)] },
      'Rate limit exceeded, per IP or per account.',
    ),
    500: unexpected,
  },
  logout: {
    200: content(ReplyEnvelopeSchema(AuthLogoutDataSchema, 'auth.logged_out'), 'Session closed.'),
    429: limited,
    500: unexpected,
  },
  me: {
    200: content(ReplyEnvelopeSchema(AuthMeDataSchema, 'auth.retrieved'), 'The current user.'),
    401: unauthenticated,
    429: limited,
    500: unexpected,
  },
  microsoft: {
    302: { description: 'Redirect to the Microsoft sign-in page.' },
    429: limited,
    500: unexpected,
    503: unavailable,
  },
  refresh: {
    200: content(ReplyEnvelopeSchema(AuthSessionDataSchema, 'auth.refreshed'), 'The new session.'),
    401: content(ErrorSchema(AuthRefreshInvalidError), 'Missing, expired or reused refresh token.'),
    429: limited,
    500: unexpected,
  },
} as const;
