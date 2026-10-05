import { InternalError } from '@/lib/errors/index.js';
import { TeamManagerInvalidError, TeamNotFoundError, TeamScheduleInvalidError } from '@/lib/errors/index.js';
import {
  ErrorSchema,
  RateLimitErrorSchema,
  ReplyEnvelopeSchema,
  TokenAuthenticationErrorSchema,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
} from '@/schemas/base/envelope.js';

import { DateBoundAnyOf, RequestLimits } from './common.js';

import type { JsonSchema } from './common.js';

const ID_EXAMPLE = '5d1f2c88-3a41-4b7e-8f0a-6c2d9e7b4a31';
const MANAGER_ID_EXAMPLE = '0b3f4a9e-7d5c-4c1c-9a39-2f5f5a7a1e10';
const OTHER_ID_EXAMPLE = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const ID_LIST_EXAMPLE = [ID_EXAMPLE, OTHER_ID_EXAMPLE];

const TIME_PATTERN = '^([01]\\d|2[0-3]):[0-5]\\d$';

const TEAM_EXAMPLE = {
  archived_at: null,
  created_at: 1_767_225_600_000,
  description: 'Customer support team of the Paris office.',
  id: ID_EXAMPLE,
  manager_id: MANAGER_ID_EXAMPLE,
  member_count: 4,
  name: 'Customer support',
  object: 'team',
  updated_at: null,
  weekly_hours_target: 35,
  work_end: '17:00',
  work_start: '09:00',
} as const;

const FAILED_EXAMPLE = [{ code: TeamNotFoundError.code, id: OTHER_ID_EXAMPLE }];

const idsProperty = {
  description: 'Identifiers of the targeted teams. Duplicates are ignored.',
  example: ID_LIST_EXAMPLE,
  items: { format: 'uuid', type: 'string' },
  maxItems: RequestLimits.bulk,
  minItems: 1,
  type: 'array',
} as const;

const BulkFailureSchema = {
  additionalProperties: false,
  properties: {
    code: {
      description: 'Error code explaining the failure.',
      example: TeamNotFoundError.code,
      type: 'string',
    },
    id: {
      description: 'Identifier that failed.',
      example: OTHER_ID_EXAMPLE,
      format: 'uuid',
      type: 'string',
    },
  },
  required: ['code', 'id'],
  type: 'object',
} as const;

const descriptionProperty = {
  description: 'Description of the team. Stored encrypted.',
  example: 'Customer support team of the Paris office.',
  maxLength: 500,
  minLength: 1,
  type: 'string',
} as const;

const managerIdProperty = {
  description: 'Identifier of the managing user. Must be an active manager or admin.',
  example: MANAGER_ID_EXAMPLE,
  format: 'uuid',
  type: 'string',
} as const;

const nameProperty = {
  description: 'Name of the team. Stored encrypted.',
  example: 'Customer support',
  maxLength: 100,
  minLength: 1,
  type: 'string',
} as const;

const weeklyHoursTargetProperty = {
  description: 'Weekly hours target of every member.',
  example: 35,
  maximum: 80,
  minimum: 1,
  type: 'integer',
} as const;

const workEndProperty = {
  description: 'End of the working day, HH:MM. Must be after work_start.',
  example: '17:00',
  maxLength: 5,
  minLength: 5,
  pattern: TIME_PATTERN,
  type: 'string',
} as const;

const workStartProperty = {
  description: 'Start of the working day, HH:MM.',
  example: '09:00',
  maxLength: 5,
  minLength: 5,
  pattern: TIME_PATTERN,
  type: 'string',
} as const;

export const TeamSchema = {
  additionalProperties: false,
  description: 'A team of users with a manager and a working schedule.',
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
    description: { ...descriptionProperty, nullable: true },
    id: { description: 'Unique identifier.', example: ID_EXAMPLE, format: 'uuid', type: 'string' },
    manager_id: managerIdProperty,
    member_count: { description: 'Number of members of the team.', example: 4, type: 'integer' },
    name: nameProperty,
    object: { description: 'Object type.', enum: ['team'], example: 'team', type: 'string' },
    updated_at: {
      description: 'Last update time in epoch milliseconds, null when never updated.',
      example: null,
      nullable: true,
      type: 'integer',
    },
    weekly_hours_target: weeklyHoursTargetProperty,
    work_end: workEndProperty,
    work_start: workStartProperty,
  },
  required: [
    'archived_at',
    'created_at',
    'description',
    'id',
    'manager_id',
    'member_count',
    'name',
    'object',
    'updated_at',
    'weekly_hours_target',
    'work_end',
    'work_start',
  ],
  type: 'object',
} as const;

export const TeamIdParamsSchema = {
  additionalProperties: false,
  properties: {
    id: { description: 'Team identifier.', example: ID_EXAMPLE, format: 'uuid', type: 'string' },
  },
  required: ['id'],
  type: 'object',
} as const;

export const TeamCreateBodySchema = {
  additionalProperties: false,
  properties: {
    description: descriptionProperty,
    manager_id: managerIdProperty,
    name: nameProperty,
    weekly_hours_target: { ...weeklyHoursTargetProperty, default: 35 },
    work_end: { ...workEndProperty, default: '17:00' },
    work_start: { ...workStartProperty, default: '09:00' },
  },
  required: ['name'],
  type: 'object',
} as const;

export const TeamListBodySchema = {
  additionalProperties: false,
  properties: {
    archived: {
      description: 'Only archived (true) or only active (false) teams.',
      example: false,
      type: 'boolean',
    },
    created_after: DateBoundAnyOf,
    created_before: DateBoundAnyOf,
    cursor: {
      description: 'Opaque cursor returned as next by a previous call.',
      example: 'MTc2NzIyNTYwMDAwMC41ZDFmMmM4OC0zYTQxLTRiN2UtOGYwYS02YzJkOWU3YjRhMzE',
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
    manager_id: { ...managerIdProperty, description: 'Only teams managed by this user.' },
    member_id: {
      description: 'Only teams this user belongs to.',
      example: OTHER_ID_EXAMPLE,
      format: 'uuid',
      type: 'string',
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

export const TeamUpdateDataSchema = {
  additionalProperties: false,
  description: 'Fields to change. Only an admin can change manager_id.',
  example: { name: 'Customer care' },
  minProperties: 1,
  properties: {
    description: {
      ...descriptionProperty,
      description: 'Description, null to clear it. Stored encrypted.',
      nullable: true,
    },
    manager_id: managerIdProperty,
    name: nameProperty,
    weekly_hours_target: weeklyHoursTargetProperty,
    work_end: workEndProperty,
    work_start: workStartProperty,
  },
  type: 'object',
} as const;

export const TeamUpdateBodySchema = {
  additionalProperties: false,
  properties: { data: TeamUpdateDataSchema, ids: idsProperty },
  required: ['data', 'ids'],
  type: 'object',
} as const;

export const TeamDeleteBodySchema = {
  additionalProperties: false,
  properties: { ids: idsProperty },
  required: ['ids'],
  type: 'object',
} as const;

const idArray = (description: string): JsonSchema => ({
  description,
  example: ID_LIST_EXAMPLE,
  items: { example: ID_EXAMPLE, format: 'uuid', type: 'string' },
  type: 'array',
});

const failedArray = {
  description: 'Identifiers that could not be processed, with the reason.',
  example: FAILED_EXAMPLE,
  items: BulkFailureSchema,
  type: 'array',
} as const;

export const TeamDataSchema = {
  additionalProperties: false,
  description: 'The team.',
  example: { team: TEAM_EXAMPLE },
  properties: { team: TeamSchema },
  required: ['team'],
  type: 'object',
} as const;

export const TeamListDataSchema = {
  additionalProperties: false,
  description: 'One page of teams with the cursor of the next page.',
  properties: {
    items: {
      description: 'Teams of the page.',
      example: [TEAM_EXAMPLE],
      items: TeamSchema,
      type: 'array',
    },
    more: { description: 'Whether another page exists.', example: false, type: 'boolean' },
    next: {
      description: 'Cursor of the next page, null on the last page.',
      example: null,
      nullable: true,
      type: 'string',
    },
    total: { description: 'Total teams matching the filters.', example: 1, type: 'integer' },
  },
  required: ['items', 'more', 'next', 'total'],
  type: 'object',
} as const;

export const TeamUpdateDataResponseSchema = {
  additionalProperties: false,
  description: 'Outcome of the bulk update.',
  properties: {
    failed: failedArray,
    success: { description: 'True when every id was updated.', example: true, type: 'boolean' },
    updated: idArray('Identifiers that were updated.'),
  },
  required: ['failed', 'success', 'updated'],
  type: 'object',
} as const;

export const TeamDeleteDataResponseSchema = {
  additionalProperties: false,
  description: 'Outcome of the bulk deletion.',
  properties: {
    deleted: idArray('Identifiers that were deleted.'),
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
const notFound = content(ErrorSchema(TeamNotFoundError), 'The team does not exist.');
const invalidInput = content(
  {
    anyOf: [
      ValidationErrorSchema,
      ErrorSchema(TeamManagerInvalidError),
      ErrorSchema(TeamScheduleInvalidError),
    ],
  },
  'Invalid request, invalid manager or invalid working hours.',
);

export const TeamResponses = {
  archive: {
    200: content(ReplyEnvelopeSchema(TeamDataSchema, 'team.archived'), 'The archived team.'),
    400: validation,
    401: unauthenticated,
    403: content(UnauthorizedErrorSchema, 'The actor may not archive this team.'),
    404: notFound,
    429: limited,
    500: unexpected,
  },
  create: {
    200: content(ReplyEnvelopeSchema(TeamDataSchema, 'team.created'), 'The created team.'),
    400: invalidInput,
    401: unauthenticated,
    403: content(UnauthorizedErrorSchema, 'The actor may not create this team.'),
    429: limited,
    500: unexpected,
  },
  delete: {
    200: content(
      ReplyEnvelopeSchema(TeamDeleteDataResponseSchema, 'team.deleted'),
      'Deleted identifiers and failures.',
    ),
    400: validation,
    401: unauthenticated,
    403: content(UnauthorizedErrorSchema, 'The actor may not delete one of these teams.'),
    429: limited,
    500: unexpected,
  },
  list: {
    200: content(ReplyEnvelopeSchema(TeamListDataSchema, 'team.listed'), 'A page of teams.'),
    400: validation,
    401: unauthenticated,
    403: content(UnauthorizedErrorSchema, 'The actor may not list teams.'),
    429: limited,
    500: unexpected,
  },
  restore: {
    200: content(ReplyEnvelopeSchema(TeamDataSchema, 'team.restored'), 'The restored team.'),
    400: validation,
    401: unauthenticated,
    403: content(UnauthorizedErrorSchema, 'The actor may not restore this team.'),
    404: notFound,
    429: limited,
    500: unexpected,
  },
  retrieve: {
    200: content(ReplyEnvelopeSchema(TeamDataSchema, 'team.retrieved'), 'The team.'),
    400: validation,
    401: unauthenticated,
    403: content(UnauthorizedErrorSchema, 'The actor may not read this team.'),
    404: notFound,
    429: limited,
    500: unexpected,
  },
  update: {
    200: content(
      ReplyEnvelopeSchema(TeamUpdateDataResponseSchema, 'team.updated'),
      'Updated identifiers and failures.',
    ),
    400: validation,
    401: unauthenticated,
    403: content(UnauthorizedErrorSchema, 'The actor may not update one of these teams or fields.'),
    429: limited,
    500: unexpected,
  },
} as const;
