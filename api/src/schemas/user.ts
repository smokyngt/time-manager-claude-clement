import { DuplicateKeyError, InternalError, UserNotFoundError  } from '@/lib/errors/index.js';
import {
  ErrorSchema,
  RateLimitErrorSchema,
  ReplyEnvelopeSchema,
  TokenAuthenticationErrorSchema,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
} from '@/schemas/base/envelope.js';
import { ROLES } from '@/types/entities/index.js';

import { BulkFailureSchema, DateBoundSchema, IdArraySchema, NAME_PATTERN, PHONE_PATTERN, RequestLimits } from './common.js';

import type { JsonSchema } from './base/envelope.js';

const ID_EXAMPLE = '0b3f4a9e-7d5c-4c1c-9a39-2f5f5a7a1e10';
const OTHER_ID_EXAMPLE = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const ID_LIST_EXAMPLE = [ID_EXAMPLE, OTHER_ID_EXAMPLE];

const USER_EXAMPLE = {
  archived_at: null,
  created_at: 1_767_225_600_000,
  email: 'jane.doe@example.com',
  first_name: 'Jane',
  id: ID_EXAMPLE,
  last_name: 'Doe',
  object: 'user',
  phone_number: '+33 6 12 34 56 78',
  role: 'employee',
  updated_at: null,
} as const;

const FAILED_EXAMPLE = [{ code: UserNotFoundError.code, id: OTHER_ID_EXAMPLE }];

const idsProperty = {
  description: 'Identifiers of the targeted users. Duplicates are ignored.',
  example: ID_LIST_EXAMPLE,
  items: { format: 'uuid', type: 'string' },
  maxItems: RequestLimits.bulk,
  minItems: 1,
  type: 'array',
} as const;

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
    created_at: {
      description: 'Creation time in epoch milliseconds.',
      example: 1_767_225_600_000,
      type: 'integer',
    },
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
    archived: {
      description: 'Only archived (true) or only active (false) users.',
      example: false,
      type: 'boolean',
    },
    created_after: DateBoundSchema,
    created_before: DateBoundSchema,
    cursor: {
      description: 'Opaque cursor returned as next by a previous call.',
      example: 'MTc2NzIyNTYwMDAwMC4wYjNmNGE5ZS03ZDVjLTRjMWMtOWEzOS0yZjVmNWE3YTFlMTA',
      maxLength: RequestLimits.cursor,
      minLength: 1,
      type: 'string',
    },
    ids: idsProperty,
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
    team_id: {
      description: 'Only members of this team.',
      example: ID_EXAMPLE,
      format: 'uuid',
      type: 'string',
    },
  },
  type: 'object',
} as const;

export const UserUpdateDataSchema = {
  additionalProperties: false,
  description: 'Fields to change. Allowed fields depend on the actor.',
  example: { first_name: 'Jane' },
  minProperties: 1,
  properties: {
    current_password: {
      description: 'Current password. Required when the actor changes their own password.',
      example: 'correct-horse-battery',
      maxLength: 128,
      minLength: 10,
      type: 'string',
      writeOnly: true,
    },
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
  properties: { data: UserUpdateDataSchema, ids: idsProperty },
  required: ['data', 'ids'],
  type: 'object',
} as const;

export const UserDeleteBodySchema = {
  additionalProperties: false,
  properties: { ids: idsProperty },
  required: ['ids'],
  type: 'object',
} as const;

const failedArray = {
  description: 'Identifiers that could not be processed, with the reason.',
  example: FAILED_EXAMPLE,
  items: BulkFailureSchema(UserNotFoundError.code, OTHER_ID_EXAMPLE),
  type: 'array',
} as const;

export const UserDataSchema = {
  additionalProperties: false,
  description: 'The user.',
  example: { user: USER_EXAMPLE },
  properties: { user: UserSchema },
  required: ['user'],
  type: 'object',
} as const;

export const UserListDataSchema = {
  additionalProperties: false,
  description: 'One page of users with the cursor of the next page.',
  properties: {
    items: {
      description: 'Users of the page.',
      example: [USER_EXAMPLE],
      items: UserSchema,
      type: 'array',
    },
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
  description: 'Outcome of the bulk update.',
  properties: {
    failed: failedArray,
    success: { description: 'True when every id was updated.', example: true, type: 'boolean' },
    updated: IdArraySchema('Identifiers that were updated.', ID_LIST_EXAMPLE),
  },
  required: ['failed', 'success', 'updated'],
  type: 'object',
} as const;

export const UserDeleteDataResponseSchema = {
  additionalProperties: false,
  description: 'Outcome of the bulk deletion.',
  properties: {
    deleted: IdArraySchema('Identifiers that were deleted.', ID_LIST_EXAMPLE),
    failed: failedArray,
    success: { description: 'True when every id was deleted.', example: true, type: 'boolean' },
  },
  required: ['deleted', 'failed', 'success'],
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
const notFound = content(ErrorSchema(UserNotFoundError), 'The user does not exist.');
const duplicate = content(ErrorSchema(DuplicateKeyError), 'A user with this email already exists.');

export const UserResponses = {
  archive: {
    200: content(ReplyEnvelopeSchema(UserDataSchema, 'user.archived'), 'The archived user.'),
    400: validation,
    401: unauthenticated,
    403: content(UnauthorizedErrorSchema, 'The actor may not archive this user.'),
    404: notFound,
    429: limited,
    500: unexpected,
  },
  create: {
    200: content(ReplyEnvelopeSchema(UserDataSchema, 'user.created'), 'The created user.'),
    400: validation,
    401: unauthenticated,
    403: content(UnauthorizedErrorSchema, 'The actor may not create this user.'),
    409: duplicate,
    429: limited,
    500: unexpected,
  },
  delete: {
    200: content(
      ReplyEnvelopeSchema(UserDeleteDataResponseSchema, 'user.deleted'),
      'Deleted identifiers and failures.',
    ),
    400: validation,
    401: unauthenticated,
    403: content(UnauthorizedErrorSchema, 'The actor may not delete one of these users.'),
    429: limited,
    500: unexpected,
  },
  list: {
    200: content(ReplyEnvelopeSchema(UserListDataSchema, 'user.listed'), 'A page of users.'),
    400: validation,
    401: unauthenticated,
    403: content(UnauthorizedErrorSchema, 'The actor may not list users.'),
    429: limited,
    500: unexpected,
  },
  restore: {
    200: content(ReplyEnvelopeSchema(UserDataSchema, 'user.restored'), 'The restored user.'),
    400: validation,
    401: unauthenticated,
    403: content(UnauthorizedErrorSchema, 'The actor may not restore this user.'),
    404: notFound,
    429: limited,
    500: unexpected,
  },
  retrieve: {
    200: content(ReplyEnvelopeSchema(UserDataSchema, 'user.retrieved'), 'The user.'),
    400: validation,
    401: unauthenticated,
    403: content(UnauthorizedErrorSchema, 'The actor may not read this user.'),
    404: notFound,
    429: limited,
    500: unexpected,
  },
  update: {
    200: content(
      ReplyEnvelopeSchema(UserUpdateDataResponseSchema, 'user.updated'),
      'Updated identifiers and failures.',
    ),
    400: validation,
    401: unauthenticated,
    403: content(UnauthorizedErrorSchema, 'The actor may not update one of these users or fields.'),
    409: duplicate,
    429: limited,
    500: unexpected,
  },
} as const;
