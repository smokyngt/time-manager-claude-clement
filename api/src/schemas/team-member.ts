import {
  TeamMemberAddError,
  TeamMemberListError,
  TeamMemberRemoveError,
  TeamMemberTeamArchivedError,
  TeamMemberTeamNotFoundError,
  TeamMemberUserNotFoundError,
} from '@/lib/errors/index.js';

import {
  ErrorSchema,
  RateLimitErrorSchema,
  ReplyEnvelopeSchema,
  TokenAuthenticationErrorSchema,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
} from './base/envelope.js';
import { RequestLimits } from './common.js';
import { UserSchema } from './user.js';

import type { JsonSchema } from './base/envelope.js';

const TEAM_ID = '0b3f4a9e-7d5c-4c1c-9a39-2f5f5a7a1e10';
const USER_ID = '5d1f7c2a-3b84-4e6f-8a21-9c0d4e7b6a53';
const USER_ID_OTHER = '8e2a6b94-1c3d-4f70-b5a8-6d9e0f1a2b34';

const userIdList = (description: string): JsonSchema => ({
  description,
  example: [USER_ID, USER_ID_OTHER],
  items: { format: 'uuid', type: 'string' },
  maxItems: RequestLimits.bulk,
  minItems: 1,
  type: 'array',
});

const idArray = (description: string): JsonSchema => ({
  description,
  example: [USER_ID],
  items: { format: 'uuid', type: 'string' },
  type: 'array',
});

export const TeamMemberFailureSchema = {
  additionalProperties: false,
  description: 'A user identifier that could not be processed.',
  properties: {
    code: {
      description: 'Error code explaining the failure.',
      example: TeamMemberUserNotFoundError.code,
      type: 'string',
    },
    id: {
      description: 'Identifier that failed.',
      example: USER_ID_OTHER,
      format: 'uuid',
      type: 'string',
    },
  },
  required: ['code', 'id'],
  type: 'object',
} as const;

const failedArray = {
  description: 'Identifiers that could not be processed, with the reason.',
  example: [{ code: TeamMemberUserNotFoundError.code, id: USER_ID_OTHER }],
  items: TeamMemberFailureSchema,
  type: 'array',
} as const;

export const TeamMemberIdParamsSchema = {
  additionalProperties: false,
  properties: {
    id: { description: 'Team identifier.', example: TEAM_ID, format: 'uuid', type: 'string' },
  },
  required: ['id'],
  type: 'object',
} as const;

export const TeamMemberAddBodySchema = {
  additionalProperties: false,
  description: 'Users to add to the team.',
  properties: { user_ids: userIdList('Users to add. Duplicates are ignored.') },
  required: ['user_ids'],
  type: 'object',
} as const;

export const TeamMemberRemoveBodySchema = {
  additionalProperties: false,
  description: 'Users to remove from the team.',
  properties: { user_ids: userIdList('Users to remove. Duplicates are ignored.') },
  required: ['user_ids'],
  type: 'object',
} as const;

export const TeamMemberListBodySchema = {
  additionalProperties: false,
  description: 'Pagination options.',
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

export const TeamMemberAddDataSchema = {
  additionalProperties: false,
  description: 'Outcome of adding members to a team.',
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
  description: 'Outcome of removing members from a team.',
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
  description: 'Page of team members.',
  properties: {
    items: {
      description: 'Members of the page.',
      example: [
        {
          archived_at: null,
          created_at: 1_760_000_000_000,
          email: 'jane.doe@example.com',
          first_name: 'Jane',
          id: USER_ID,
          last_name: 'Doe',
          object: 'user',
          phone_number: null,
          role: 'employee',
          updated_at: null,
        },
      ],
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
    total: { description: 'Total members of the team.', example: 1, type: 'integer' },
  },
  required: ['items', 'more', 'next', 'total'],
  type: 'object',
} as const;

const wrap = (schema: JsonSchema, description: string): JsonSchema => ({
  content: { 'application/json': { schema } },
  description,
});

export const TeamMemberResponses = {
  add: {
    200: wrap(
      ReplyEnvelopeSchema(TeamMemberAddDataSchema, 'team.members.added'),
      'Members added.',
    ),
    400: wrap(ValidationErrorSchema, 'Invalid request.'),
    401: wrap(TokenAuthenticationErrorSchema, 'Missing or invalid access token.'),
    403: wrap(UnauthorizedErrorSchema, 'The caller may not manage the members of this team.'),
    404: wrap(ErrorSchema(TeamMemberTeamNotFoundError), 'The team does not exist.'),
    409: wrap(ErrorSchema(TeamMemberTeamArchivedError), 'The team is archived.'),
    429: wrap(RateLimitErrorSchema, 'Rate limit exceeded.'),
    500: wrap(ErrorSchema(TeamMemberAddError), 'The operation failed unexpectedly.'),
  },
  list: {
    200: wrap(
      ReplyEnvelopeSchema(TeamMemberListDataSchema, 'team.members.listed'),
      'Page of members.',
    ),
    400: wrap(ValidationErrorSchema, 'Invalid request.'),
    401: wrap(TokenAuthenticationErrorSchema, 'Missing or invalid access token.'),
    403: wrap(UnauthorizedErrorSchema, 'The caller may not see this team.'),
    404: wrap(ErrorSchema(TeamMemberTeamNotFoundError), 'The team does not exist.'),
    429: wrap(RateLimitErrorSchema, 'Rate limit exceeded.'),
    500: wrap(ErrorSchema(TeamMemberListError), 'The operation failed unexpectedly.'),
  },
  remove: {
    200: wrap(
      ReplyEnvelopeSchema(TeamMemberRemoveDataSchema, 'team.members.removed'),
      'Members removed.',
    ),
    400: wrap(ValidationErrorSchema, 'Invalid request.'),
    401: wrap(TokenAuthenticationErrorSchema, 'Missing or invalid access token.'),
    403: wrap(UnauthorizedErrorSchema, 'The caller may not manage the members of this team.'),
    404: wrap(ErrorSchema(TeamMemberTeamNotFoundError), 'The team does not exist.'),
    429: wrap(RateLimitErrorSchema, 'Rate limit exceeded.'),
    500: wrap(ErrorSchema(TeamMemberRemoveError), 'The operation failed unexpectedly.'),
  },
} as const;
