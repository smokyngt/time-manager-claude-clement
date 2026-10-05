import {
  BulkFailureSchema,
  errorResponse,
  IdListSchema,
  ReplyEnvelopeSchema,
  RequestLimits,
} from './common.js';
import { UserSchema } from './user.js';

import type { JsonSchema } from './common.js';

const ID_EXAMPLE = '0b3f4a9e-7d5c-4c1c-9a39-2f5f5a7a1e10';

export const TeamMemberIdParamsSchema = {
  additionalProperties: false,
  properties: {
    id: { description: 'Team identifier.', example: ID_EXAMPLE, format: 'uuid', type: 'string' },
  },
  required: ['id'],
  type: 'object',
} as const;

export const TeamMemberAddBodySchema = {
  additionalProperties: false,
  properties: { user_ids: IdListSchema },
  required: ['user_ids'],
  type: 'object',
} as const;

export const TeamMemberRemoveBodySchema = {
  additionalProperties: false,
  properties: { user_ids: IdListSchema },
  required: ['user_ids'],
  type: 'object',
} as const;

export const TeamMemberListBodySchema = {
  additionalProperties: false,
  properties: {
    cursor: {
      description: 'Opaque cursor returned as next by a previous call.',
      example: 'MTc2NzIyNTYwMDAwMC4wYjNmNGE5ZS03ZDVjLTRjMWMtOWEzOS0yZjVmNWE3YTFlMTA',
      maxLength: RequestLimits.cursor,
      minLength: 1,
      type: 'string',
    },
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
  },
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

export const TeamMemberAddDataSchema = {
  additionalProperties: false,
  properties: {
    added: idArray('Identifiers of the users that became members.'),
    failed: failedArray,
    success: { description: 'True when no id failed.', example: true, type: 'boolean' },
  },
  required: ['added', 'failed', 'success'],
  type: 'object',
} as const;

export const TeamMemberRemoveDataSchema = {
  additionalProperties: false,
  properties: {
    failed: failedArray,
    removed: idArray('Identifiers of the users that were removed from the team.'),
    success: { description: 'True when no id failed.', example: true, type: 'boolean' },
  },
  required: ['failed', 'removed', 'success'],
  type: 'object',
} as const;

export const TeamMemberListDataSchema = {
  additionalProperties: false,
  properties: {
    items: { description: 'Members of the page.', items: UserSchema, type: 'array' },
    more: { description: 'Whether another page exists.', example: false, type: 'boolean' },
    next: {
      description: 'Cursor of the next page, null on the last page.',
      example: null,
      nullable: true,
      type: 'string',
    },
    total: { description: 'Total members of the team.', example: 1, type: 'integer' },
  },
  required: ['items', 'more', 'next', 'total'],
  type: 'object',
} as const;

export const TeamMemberResponses = {
  add: {
    200: ReplyEnvelopeSchema(TeamMemberAddDataSchema, 'team.members.added'),
    400: errorResponse('Invalid request body.'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not manage the members of this team.'),
    404: errorResponse('The team does not exist.'),
    409: errorResponse('The team is archived.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  list: {
    200: ReplyEnvelopeSchema(TeamMemberListDataSchema, 'team.members.listed'),
    400: errorResponse('Invalid cursor.'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not see this team.'),
    404: errorResponse('The team does not exist.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  remove: {
    200: ReplyEnvelopeSchema(TeamMemberRemoveDataSchema, 'team.members.removed'),
    400: errorResponse('Invalid request body.'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not manage the members of this team.'),
    404: errorResponse('The team does not exist.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
} as const;
