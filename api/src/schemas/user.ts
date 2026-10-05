import { ROLES } from '@/types/entities/user.js';

import {
  BulkFailureSchema,
  DateBoundAnyOf,
  IdListSchema,
  NAME_PATTERN,
  PHONE_PATTERN,
  RequestLimits,
  ReplyEnvelopeSchema,
  errorResponse,
} from './common.js';

import type { JsonSchema } from './common.js';

const ID_EXAMPLE = '0b3f4a9e-7d5c-4c1c-9a39-2f5f5a7a1e10';

const emailProperty = {
  description: 'Email address, stored lowercased. Unique.',
  example: 'jane.doe@example.com',
  format: 'email',
  maxLength: 254,
  type: 'string',
} as const;

const firstNameProperty = {
  description: 'First name.',
  example: 'Jane',
  maxLength: 100,
  minLength: 1,
  pattern: NAME_PATTERN,
  type: 'string',
} as const;

const lastNameProperty = {
  description: 'Last name.',
  example: 'Doe',
  maxLength: 100,
  minLength: 1,
  pattern: NAME_PATTERN,
  type: 'string',
} as const;

const passwordProperty = {
  description: 'Password, 10 to 128 characters. Stored as an argon2id hash.',
  example: 'correct-horse-battery',
  maxLength: 128,
  minLength: 10,
  type: 'string',
} as const;

const roleProperty = {
  description: 'Role of the user.',
  enum: ROLES,
  example: 'employee',
  type: 'string',
} as const;

export const UserSchema = {
  additionalProperties: false,
  description: 'A user of the application.',
  properties: {
    archived_at: {
      description: 'Archival time in epoch milliseconds, null when active.',
      example: null,
      nullable: true,
      type: 'integer',
    },
    created_at: { description: 'Creation time in epoch milliseconds.', example: 1767225600000, type: 'integer' },
    email: emailProperty,
    first_name: firstNameProperty,
    id: { description: 'Unique identifier.', example: ID_EXAMPLE, format: 'uuid', type: 'string' },
    last_name: lastNameProperty,
    object: { description: 'Object type.', enum: ['user'], example: 'user', type: 'string' },
    phone_number: {
      description: 'Phone number, null when unknown.',
      example: '+33 6 12 34 56 78',
      nullable: true,
      type: 'string',
    },
    role: roleProperty,
    updated_at: {
      description: 'Last update time in epoch milliseconds, null when never updated.',
      example: null,
      nullable: true,
      type: 'integer',
    },
  },
  required: [
    'archived_at',
    'created_at',
    'email',
    'first_name',
    'id',
    'last_name',
    'object',
    'phone_number',
    'role',
    'updated_at',
  ],
  type: 'object',
} as const;

export const UserIdParamsSchema = {
  additionalProperties: false,
  properties: {
    id: { description: 'User identifier.', example: ID_EXAMPLE, format: 'uuid', type: 'string' },
  },
  required: ['id'],
  type: 'object',
} as const;

export const UserCreateBodySchema = {
  additionalProperties: false,
  properties: {
    email: emailProperty,
    first_name: firstNameProperty,
    last_name: lastNameProperty,
    password: passwordProperty,
    phone_number: {
      description: 'Phone number.',
      example: '+33 6 12 34 56 78',
      maxLength: 20,
      minLength: 6,
      pattern: PHONE_PATTERN,
      type: 'string',
    },
    role: { ...roleProperty, default: 'employee' },
  },
  required: ['email', 'first_name', 'last_name'],
  type: 'object',
} as const;

export const UserListBodySchema = {
  additionalProperties: false,
  properties: {
    archived: { description: 'Only archived (true) or only active (false) users.', example: false, type: 'boolean' },
    created_after: DateBoundAnyOf,
    created_before: DateBoundAnyOf,
    cursor: {
      description: 'Opaque cursor returned as next by a previous call.',
      example: 'MTc2NzIyNTYwMDAwMC4wYjNmNGE5ZS03ZDVjLTRjMWMtOWEzOS0yZjVmNWE3YTFlMTA',
      maxLength: RequestLimits.cursor,
      minLength: 1,
      type: 'string',
    },
    ids: IdListSchema,
    limit: {
      default: RequestLimits.limitDefault,
      description: 'Page size.',
      example: 25,
      maximum: RequestLimits.limit,
      minimum: 1,
      type: 'integer',
    },
    order: {
      default: 'desc',
      description: 'Sort direction on created_at.',
      enum: ['asc', 'desc'],
      example: 'desc',
      type: 'string',
    },
    role: roleProperty,
  },
  type: 'object',
} as const;

export const UserUpdateDataSchema = {
  additionalProperties: false,
  description: 'Fields to change. Allowed fields depend on the actor.',
  minProperties: 1,
  properties: {
    email: emailProperty,
    first_name: firstNameProperty,
    last_name: lastNameProperty,
    password: passwordProperty,
    phone_number: {
      description: 'Phone number, null to clear it.',
      example: '+33 6 12 34 56 78',
      maxLength: 20,
      minLength: 6,
      nullable: true,
      pattern: PHONE_PATTERN,
      type: 'string',
    },
    role: roleProperty,
  },
  type: 'object',
} as const;

export const UserUpdateBodySchema = {
  additionalProperties: false,
  properties: { data: UserUpdateDataSchema, ids: IdListSchema },
  required: ['data', 'ids'],
  type: 'object',
} as const;

export const UserDeleteBodySchema = {
  additionalProperties: false,
  properties: { ids: IdListSchema },
  required: ['ids'],
  type: 'object',
} as const;

const idArray = (description: string): JsonSchema => ({
  description,
  items: { example: ID_EXAMPLE, format: 'uuid', type: 'string' },
  type: 'array',
});

const failedArray = {
  description: 'Identifiers that could not be processed, with the reason.',
  items: BulkFailureSchema,
  type: 'array',
} as const;

export const UserCreateDataSchema = UserSchema;

export const UserListDataSchema = {
  additionalProperties: false,
  properties: {
    items: { description: 'Users of the page.', items: UserSchema, type: 'array' },
    more: { description: 'Whether another page exists.', example: false, type: 'boolean' },
    next: {
      description: 'Cursor of the next page, null on the last page.',
      example: null,
      nullable: true,
      type: 'string',
    },
    total: { description: 'Total users matching the filters.', example: 1, type: 'integer' },
  },
  required: ['items', 'more', 'next', 'total'],
  type: 'object',
} as const;

export const UserUpdateDataResponseSchema = {
  additionalProperties: false,
  properties: {
    failed: failedArray,
    success: { description: 'True when every id was updated.', example: true, type: 'boolean' },
    updated: idArray('Identifiers that were updated.'),
  },
  required: ['failed', 'success', 'updated'],
  type: 'object',
} as const;

export const UserDeleteDataResponseSchema = {
  additionalProperties: false,
  properties: {
    deleted: idArray('Identifiers that were deleted.'),
    failed: failedArray,
    success: { description: 'True when every id was deleted.', example: true, type: 'boolean' },
  },
  required: ['deleted', 'failed', 'success'],
  type: 'object',
} as const;

export const UserResponses = {
  archive: {
    200: ReplyEnvelopeSchema(UserSchema, 'user.archived'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not archive this user.'),
    404: errorResponse('The user does not exist.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  create: {
    200: ReplyEnvelopeSchema(UserCreateDataSchema, 'user.created'),
    400: errorResponse('Invalid request body.'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not create this user.'),
    409: errorResponse('A user with this email already exists.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  delete: {
    200: ReplyEnvelopeSchema(UserDeleteDataResponseSchema, 'user.deleted'),
    400: errorResponse('Invalid request body.'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not delete one of these users.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  list: {
    200: ReplyEnvelopeSchema(UserListDataSchema, 'user.listed'),
    400: errorResponse('Invalid filters or cursor.'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not list users.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  restore: {
    200: ReplyEnvelopeSchema(UserSchema, 'user.restored'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not restore this user.'),
    404: errorResponse('The user does not exist.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  retrieve: {
    200: ReplyEnvelopeSchema(UserSchema, 'user.retrieved'),
    400: errorResponse('Invalid identifier.'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not read this user.'),
    404: errorResponse('The user does not exist.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  update: {
    200: ReplyEnvelopeSchema(UserUpdateDataResponseSchema, 'user.updated'),
    400: errorResponse('Invalid request body.'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not update one of these users or fields.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
} as const;
