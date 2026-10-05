import { CLOCK_SOURCES } from '@/types/entities/clock.js';

import {
  BulkFailureSchema,
  DateBoundAnyOf,
  errorResponse,
  ReplyEnvelopeSchema,
  RequestLimits,
} from './common.js';

import type { JsonSchema } from './common.js';

const ID_EXAMPLE = '5d1c8f0e-2b7a-4c3e-9f41-8a6d3b2c9e77';
const USER_ID_EXAMPLE = '0b3f4a9e-7d5c-4c1c-9a39-2f5f5a7a1e10';

const clockedInProperty = {
  description: 'Clock-in time in epoch milliseconds. Cannot be in the future.',
  example: 1767254400000,
  minimum: 0,
  type: 'integer',
} as const;

const clockedOutProperty = {
  description:
    'Clock-out time in epoch milliseconds. Must be after the clock-in time, not in the future, and at most 24 hours after the clock-in time.',
  example: 1767283200000,
  minimum: 0,
  type: 'integer',
} as const;

const noteProperty = {
  description: 'Free text note.',
  example: 'Worked from the client site.',
  maxLength: 500,
  minLength: 1,
  type: 'string',
} as const;

const userIdProperty = {
  description: 'Identifier of the user the clock belongs to.',
  example: USER_ID_EXAMPLE,
  format: 'uuid',
  type: 'string',
} as const;

const idList = (description: string): JsonSchema => ({
  description,
  items: { format: 'uuid', type: 'string' },
  maxItems: RequestLimits.bulk,
  minItems: 1,
  type: 'array',
});

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

export const ClockSchema = {
  additionalProperties: false,
  description: 'A time clock entry of a user.',
  properties: {
    clocked_in_at: { ...clockedInProperty, description: 'Clock-in time in epoch milliseconds.' },
    clocked_out_at: {
      description: 'Clock-out time in epoch milliseconds, null while the clock is open.',
      example: 1767283200000,
      nullable: true,
      type: 'integer',
    },
    created_at: {
      description: 'Creation time in epoch milliseconds.',
      example: 1767254400000,
      type: 'integer',
    },
    duration_ms: {
      description: 'Duration in milliseconds, null while the clock is open.',
      example: 28800000,
      nullable: true,
      type: 'integer',
    },
    id: { description: 'Unique identifier.', example: ID_EXAMPLE, format: 'uuid', type: 'string' },
    note: {
      description: 'Free text note, null when absent.',
      example: 'Worked from the client site.',
      maxLength: 500,
      nullable: true,
      type: 'string',
    },
    object: { description: 'Object type.', enum: ['clock'], example: 'clock', type: 'string' },
    source: {
      description: 'How the clock was recorded: by the user (clock) or entered by a manager (manual).',
      enum: CLOCK_SOURCES,
      example: 'clock',
      type: 'string',
    },
    updated_at: {
      description: 'Last update time in epoch milliseconds, null when never updated.',
      example: null,
      nullable: true,
      type: 'integer',
    },
    user_id: userIdProperty,
  },
  required: [
    'clocked_in_at',
    'clocked_out_at',
    'created_at',
    'duration_ms',
    'id',
    'note',
    'object',
    'source',
    'updated_at',
    'user_id',
  ],
  type: 'object',
} as const;

export const ClockIdParamsSchema = {
  additionalProperties: false,
  properties: {
    id: { description: 'Clock identifier.', example: ID_EXAMPLE, format: 'uuid', type: 'string' },
  },
  required: ['id'],
  type: 'object',
} as const;

export const ClockNoteBodySchema = {
  additionalProperties: false,
  description: 'Optional note. Send an empty object when there is none.',
  properties: { note: noteProperty },
  type: 'object',
} as const;

export const ClockCreateBodySchema = {
  additionalProperties: false,
  properties: {
    clocked_in_at: clockedInProperty,
    clocked_out_at: clockedOutProperty,
    note: noteProperty,
    user_id: userIdProperty,
  },
  required: ['clocked_in_at', 'clocked_out_at', 'user_id'],
  type: 'object',
} as const;

export const ClockListBodySchema = {
  additionalProperties: false,
  properties: {
    cursor: {
      description: 'Opaque cursor returned as next by a previous call.',
      example: 'MTc2NzIyNTYwMDAwMC4wYjNmNGE5ZS03ZDVjLTRjMWMtOWEzOS0yZjVmNWE3YTFlMTA',
      maxLength: RequestLimits.cursor,
      minLength: 1,
      type: 'string',
    },
    from: { ...DateBoundAnyOf, description: 'Lower bound on clocked_in_at, inclusive.' },
    limit: {
      default: RequestLimits.limitDefault,
      description: 'Page size.',
      example: 25,
      maximum: RequestLimits.limit,
      minimum: 1,
      type: 'integer',
    },
    open: {
      description: 'Only open clocks (true) or only closed clocks (false).',
      example: false,
      type: 'boolean',
    },
    order: {
      default: 'desc',
      description: 'Sort direction on created_at.',
      enum: ['asc', 'desc'],
      example: 'desc',
      type: 'string',
    },
    to: { ...DateBoundAnyOf, description: 'Upper bound on clocked_in_at, inclusive.' },
    user_ids: idList(
      'Restrict to these users. Employees always get their own clocks, managers are limited to themselves and their managed users.',
    ),
  },
  type: 'object',
} as const;

export const ClockUpdateDataSchema = {
  additionalProperties: false,
  description: 'Fields to change.',
  minProperties: 1,
  properties: {
    clocked_in_at: clockedInProperty,
    clocked_out_at: clockedOutProperty,
    note: { ...noteProperty, description: 'Free text note, null to clear it.', nullable: true },
  },
  type: 'object',
} as const;

export const ClockUpdateBodySchema = {
  additionalProperties: false,
  properties: {
    data: ClockUpdateDataSchema,
    ids: idList('List of clock identifiers. Duplicates are ignored.'),
  },
  required: ['data', 'ids'],
  type: 'object',
} as const;

export const ClockDeleteBodySchema = {
  additionalProperties: false,
  properties: { ids: idList('List of clock identifiers. Duplicates are ignored.') },
  required: ['ids'],
  type: 'object',
} as const;

export const ClockCurrentDataSchema = {
  additionalProperties: false,
  properties: {
    clock: { ...ClockSchema, description: 'The open clock, null when not clocked in.', nullable: true },
  },
  required: ['clock'],
  type: 'object',
} as const;

export const ClockListDataSchema = {
  additionalProperties: false,
  properties: {
    items: { description: 'Clocks of the page.', items: ClockSchema, type: 'array' },
    more: { description: 'Whether another page exists.', example: false, type: 'boolean' },
    next: {
      description: 'Cursor of the next page, null on the last page.',
      example: null,
      nullable: true,
      type: 'string',
    },
    total: { description: 'Total clocks matching the filters.', example: 1, type: 'integer' },
  },
  required: ['items', 'more', 'next', 'total'],
  type: 'object',
} as const;

export const ClockUpdateDataResponseSchema = {
  additionalProperties: false,
  properties: {
    failed: failedArray,
    success: { description: 'True when every id was updated.', example: true, type: 'boolean' },
    updated: idArray('Identifiers that were updated.'),
  },
  required: ['failed', 'success', 'updated'],
  type: 'object',
} as const;

export const ClockDeleteDataResponseSchema = {
  additionalProperties: false,
  properties: {
    deleted: idArray('Identifiers that were deleted.'),
    failed: failedArray,
    success: { description: 'True when every id was deleted.', example: true, type: 'boolean' },
  },
  required: ['deleted', 'failed', 'success'],
  type: 'object',
} as const;

export const ClockResponses = {
  create: {
    200: ReplyEnvelopeSchema(ClockSchema, 'clock.created'),
    400: errorResponse('Invalid request body or invalid clock timestamps.'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not create a clock for this user.'),
    404: errorResponse('The user does not exist.'),
    409: errorResponse('The clock overlaps another clock of the same user.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  current: {
    200: ReplyEnvelopeSchema(ClockCurrentDataSchema, 'clock.current'),
    401: errorResponse('Missing or invalid access token.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  delete: {
    200: ReplyEnvelopeSchema(ClockDeleteDataResponseSchema, 'clock.deleted'),
    400: errorResponse('Invalid request body.'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not delete one of these clocks.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  in: {
    200: ReplyEnvelopeSchema(ClockSchema, 'clock.in'),
    400: errorResponse('Invalid request body.'),
    401: errorResponse('Missing or invalid access token.'),
    409: errorResponse('The user is already clocked in.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  list: {
    200: ReplyEnvelopeSchema(ClockListDataSchema, 'clock.listed'),
    400: errorResponse('Invalid filters or cursor.'),
    401: errorResponse('Missing or invalid access token.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  out: {
    200: ReplyEnvelopeSchema(ClockSchema, 'clock.out'),
    400: errorResponse('Invalid request body or the clock exceeds 24 hours.'),
    401: errorResponse('Missing or invalid access token.'),
    409: errorResponse('The user is not clocked in.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  retrieve: {
    200: ReplyEnvelopeSchema(ClockSchema, 'clock.retrieved'),
    400: errorResponse('Invalid identifier.'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not read this clock.'),
    404: errorResponse('The clock does not exist.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  update: {
    200: ReplyEnvelopeSchema(ClockUpdateDataResponseSchema, 'clock.updated'),
    400: errorResponse('Invalid request body.'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not update one of these clocks.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
} as const;
