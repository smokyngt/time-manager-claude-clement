import { ReplyEnvelopeSchema, errorResponse } from './common.js';
import { UserSchema } from './user.js';

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

export const AuthSessionSchema = {
  additionalProperties: false,
  properties: {
    access_token: {
      description: 'Short-lived JWT to send as a Bearer token. Keep it in memory.',
      example: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature',
      type: 'string',
    },
    expires_in: { description: 'Access token lifetime in seconds.', example: 900, type: 'integer' },
    token_type: { description: 'Token type.', enum: ['Bearer'], example: 'Bearer', type: 'string' },
    user: UserSchema,
  },
  required: ['access_token', 'expires_in', 'token_type', 'user'],
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

export const AuthCallbackQuerySchema = {
  additionalProperties: true,
  properties: {
    code: { description: 'Authorization code issued by Microsoft.', maxLength: 4096, minLength: 1, type: 'string' },
    error: { description: 'Error code sent by Microsoft when the user refused.', maxLength: 200, type: 'string' },
    error_description: { description: 'Error details sent by Microsoft.', maxLength: 2000, type: 'string' },
    state: { description: 'State echoed back by Microsoft.', maxLength: 200, minLength: 1, type: 'string' },
  },
  type: 'object',
} as const;

export const AuthResponses = {
  callback: {
    302: {
      description: 'Redirect to the web application, which then calls the refresh endpoint.',
      type: 'null',
    },
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
    503: errorResponse('Microsoft sign-in is not configured.'),
  },
  login: {
    200: ReplyEnvelopeSchema(AuthSessionSchema, 'auth.logged_in'),
    400: errorResponse('Invalid request body.'),
    401: errorResponse('Invalid credentials.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  logout: {
    200: ReplyEnvelopeSchema(AuthLogoutDataSchema, 'auth.logged_out'),
    401: errorResponse('Missing or invalid access token.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  me: {
    200: ReplyEnvelopeSchema(UserSchema, 'auth.retrieved'),
    401: errorResponse('Missing or invalid access token.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  microsoft: {
    302: { description: 'Redirect to the Microsoft sign-in page.', type: 'null' },
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
    503: errorResponse('Microsoft sign-in is not configured.'),
  },
  refresh: {
    200: ReplyEnvelopeSchema(AuthSessionSchema, 'auth.refreshed'),
    401: errorResponse('Missing, expired or reused refresh token.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
} as const;
