import {
  BulkFailureSchema,
  DateBoundAnyOf,
  errorResponse,
  ReplyEnvelopeSchema,
  RequestLimits,
} from './common.js';

import type { JsonSchema } from './common.js';

const ID_EXAMPLE = '5d1f2c88-3a41-4b7e-8f0a-6c2d9e7b4a31';

const TIME_PATTERN = '^([01]\\d|2[0-3]):[0-5]\\d$';

const descriptionProperty = {
  description: 'Description of the team.',
  example: 'Customer support team of the Paris office.',
  maxLength: 500,
  minLength: 1,
  type: 'string',
} as const;

const managerIdProperty = {
  description: 'Identifier of the managing user. Must be an active manager or admin.',
  example: ID_EXAMPLE,
  format: 'uuid',
  type: 'string',
} as const;

const nameProperty = {
  description: 'Name of the team.',
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

export const TeamIdListSchema = {
  description: 'List of team identifiers. Duplicates are ignored.',
  items: { format: 'uuid', type: 'string' },
  maxItems: RequestLimits.bulk,
  minItems: 1,
  type: 'array',
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
      example: 1767225600000,
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
    ids: TeamIdListSchema,
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
      example: ID_EXAMPLE,
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
  minProperties: 1,
  properties: {
    description: {
      ...descriptionProperty,
      description: 'Description, null to clear it.',
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
  properties: { data: TeamUpdateDataSchema, ids: TeamIdListSchema },
  required: ['data', 'ids'],
  type: 'object',
} as const;

export const TeamDeleteBodySchema = {
  additionalProperties: false,
  properties: { ids: TeamIdListSchema },
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

export const TeamCreateDataSchema = TeamSchema;

export const TeamListDataSchema = {
  additionalProperties: false,
  properties: {
    items: { description: 'Teams of the page.', items: TeamSchema, type: 'array' },
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
  properties: {
    deleted: idArray('Identifiers that were deleted.'),
    failed: failedArray,
    success: { description: 'True when every id was deleted.', example: true, type: 'boolean' },
  },
  required: ['deleted', 'failed', 'success'],
  type: 'object',
} as const;

export const TeamResponses = {
  archive: {
    200: ReplyEnvelopeSchema(TeamSchema, 'team.archived'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not archive this team.'),
    404: errorResponse('The team does not exist.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  create: {
    200: ReplyEnvelopeSchema(TeamCreateDataSchema, 'team.created'),
    400: errorResponse('Invalid request body, invalid manager or invalid working hours.'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not create this team.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  delete: {
    200: ReplyEnvelopeSchema(TeamDeleteDataResponseSchema, 'team.deleted'),
    400: errorResponse('Invalid request body.'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not delete one of these teams.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  list: {
    200: ReplyEnvelopeSchema(TeamListDataSchema, 'team.listed'),
    400: errorResponse('Invalid filters or cursor.'),
    401: errorResponse('Missing or invalid access token.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  restore: {
    200: ReplyEnvelopeSchema(TeamSchema, 'team.restored'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not restore this team.'),
    404: errorResponse('The team does not exist.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  retrieve: {
    200: ReplyEnvelopeSchema(TeamSchema, 'team.retrieved'),
    400: errorResponse('Invalid identifier.'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not read this team.'),
    404: errorResponse('The team does not exist.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  update: {
    200: ReplyEnvelopeSchema(TeamUpdateDataResponseSchema, 'team.updated'),
    400: errorResponse('Invalid request body.'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not update one of these teams or fields.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
} as const;
