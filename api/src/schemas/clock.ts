import { InternalError } from '@/lib/errors/index.js';
import {
  ClockConflictError,
  ClockInvalidError,
  ClockNotFoundError,
  ClockOverlapError,
} from '@/lib/errors/index.js';
import { UserNotFoundError } from '@/lib/errors/index.js';
import {
  ErrorSchema,
  RateLimitErrorSchema,
  ReplyEnvelopeSchema,
  TokenAuthenticationErrorSchema,
  UnauthorizedErrorSchema,
  ValidationErrorSchema,
} from '@/schemas/base/envelope.js';
import { CLOCK_SOURCES } from '@/types/entities/index.js';

import { DateBoundAnyOf, RequestLimits } from './common.js';

import type { JsonSchema } from './common.js';

const ID_EXAMPLE = '5d1c8f0e-2b7a-4c3e-9f41-8a6d3b2c9e77';
const OTHER_ID_EXAMPLE = '9a2e4c1b-6f3d-4e8a-b7c5-1d0f2a3b4c5d';
const USER_ID_EXAMPLE = '0b3f4a9e-7d5c-4c1c-9a39-2f5f5a7a1e10';
const ID_LIST_EXAMPLE = [ID_EXAMPLE, OTHER_ID_EXAMPLE];
const CLOCKED_IN_EXAMPLE = 1_768_208_400_000;
const CLOCKED_OUT_EXAMPLE = 1_768_239_000_000;
const DURATION_EXAMPLE = 30_600_000;
const NOTE_EXAMPLE = 'Worked from the client site.';

const CLOCK_EXAMPLE = {
  clocked_in_at: CLOCKED_IN_EXAMPLE,
  clocked_out_at: CLOCKED_OUT_EXAMPLE,
  created_at: CLOCKED_IN_EXAMPLE,
  duration_ms: DURATION_EXAMPLE,
  id: ID_EXAMPLE,
  note: NOTE_EXAMPLE,
  object: 'clock',
  source: 'clock',
  updated_at: CLOCKED_OUT_EXAMPLE,
  user_id: USER_ID_EXAMPLE,
} as const;

const OPEN_CLOCK_EXAMPLE = {
  ...CLOCK_EXAMPLE,
  clocked_out_at: null,
  duration_ms: null,
  note: null,
  updated_at: null,
} as const;

const FAILED_EXAMPLE = [{ code: ClockNotFoundError.code, id: OTHER_ID_EXAMPLE }];

const idsProperty = {
  description: 'Identifiers of the targeted clocks. Duplicates are ignored.',
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
      example: ClockNotFoundError.code,
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

const clockedInProperty = {
  description: 'Clock-in time in epoch milliseconds. Cannot be in the future.',
  example: CLOCKED_IN_EXAMPLE,
  minimum: 0,
  type: 'integer',
} as const;

const clockedOutProperty = {
  description:
    'Clock-out time in epoch milliseconds. Must be after the clock-in time, not in the future, and at most 24 hours after the clock-in time.',
  example: CLOCKED_OUT_EXAMPLE,
  minimum: 0,
  type: 'integer',
} as const;

const noteProperty = {
  description: 'Free text note, stored encrypted.',
  example: NOTE_EXAMPLE,
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

export const ClockSchema = {
  additionalProperties: false,
  description: 'A time clock entry of a user. It is open until a clock-out time is recorded.',
  properties: {
    clocked_in_at: {
      description: 'Clock-in time in epoch milliseconds.',
      example: CLOCKED_IN_EXAMPLE,
      type: 'integer',
    },
    clocked_out_at: {
      description: 'Clock-out time in epoch milliseconds, null while the clock is open.',
      example: CLOCKED_OUT_EXAMPLE,
      nullable: true,
      type: 'integer',
    },
    created_at: {
      description: 'Creation time in epoch milliseconds.',
      example: CLOCKED_IN_EXAMPLE,
      type: 'integer',
    },
    duration_ms: {
      description: 'Duration in milliseconds, null while the clock is open.',
      example: DURATION_EXAMPLE,
      nullable: true,
      type: 'integer',
    },
    id: { description: 'Unique identifier.', example: ID_EXAMPLE, format: 'uuid', type: 'string' },
    note: {
      description: 'Free text note, null when absent.',
      example: NOTE_EXAMPLE,
      maxLength: 500,
      nullable: true,
      type: 'string',
    },
    object: { description: 'Object type.', enum: ['clock'], example: 'clock', type: 'string' },
    source: {
      description:
        'How the clock was recorded: by the user (clock) or entered by a manager or an admin (manual).',
      enum: CLOCK_SOURCES,
      example: 'clock',
      type: 'string',
    },
    updated_at: {
      description: 'Last update time in epoch milliseconds, null when never updated.',
      example: CLOCKED_OUT_EXAMPLE,
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

export const ClockInBodySchema = {
  additionalProperties: false,
  description: 'Optional note recorded with the clock-in. Send an empty object when there is none.',
  example: { note: 'Starting at the client site.' },
  properties: { note: noteProperty },
  type: 'object',
} as const;

export const ClockOutBodySchema = {
  additionalProperties: false,
  description:
    'Optional note recorded with the clock-out. It replaces the note given at clock-in. Send an empty object to keep it.',
  example: { note: NOTE_EXAMPLE },
  properties: { note: noteProperty },
  type: 'object',
} as const;

export const ClockCreateBodySchema = {
  additionalProperties: false,
  description: 'Manual entry of a closed clock for a user.',
  example: {
    clocked_in_at: CLOCKED_IN_EXAMPLE,
    clocked_out_at: CLOCKED_OUT_EXAMPLE,
    note: 'Forgot to clock out, corrected by the manager.',
    user_id: USER_ID_EXAMPLE,
  },
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
  description: 'Filters and pagination options. Every field is optional.',
  example: { limit: 25, open: false, order: 'desc' },
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
    user_ids: {
      description:
        'Restrict to these users. Employees always get their own clocks, managers are limited to themselves and the users they manage.',
      example: [USER_ID_EXAMPLE],
      items: { format: 'uuid', type: 'string' },
      maxItems: RequestLimits.bulk,
      minItems: 1,
      type: 'array',
    },
  },
  type: 'object',
} as const;

export const ClockUpdateDataSchema = {
  additionalProperties: false,
  description: 'Fields to change. The resulting clock must stay valid and must not overlap another one.',
  example: { clocked_out_at: CLOCKED_OUT_EXAMPLE },
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
  properties: { data: ClockUpdateDataSchema, ids: idsProperty },
  required: ['data', 'ids'],
  type: 'object',
} as const;

export const ClockDeleteBodySchema = {
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

export const ClockDataSchema = {
  additionalProperties: false,
  description: 'The clock.',
  example: { clock: CLOCK_EXAMPLE },
  properties: { clock: ClockSchema },
  required: ['clock'],
  type: 'object',
} as const;

export const ClockCurrentDataSchema = {
  additionalProperties: false,
  description: 'The open clock of the caller, or null when the caller is not clocked in.',
  example: { clock: OPEN_CLOCK_EXAMPLE },
  properties: {
    clock: {
      ...ClockSchema,
      description: 'The open clock, null when not clocked in.',
      example: OPEN_CLOCK_EXAMPLE,
      nullable: true,
    },
  },
  required: ['clock'],
  type: 'object',
} as const;

export const ClockListDataSchema = {
  additionalProperties: false,
  description: 'One page of clocks with the cursor of the next page.',
  properties: {
    items: {
      description: 'Clocks of the page.',
      example: [CLOCK_EXAMPLE],
      items: ClockSchema,
      type: 'array',
    },
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
  description: 'Outcome of the bulk update.',
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
const invalid = content(
  {
    anyOf: [ValidationErrorSchema, ErrorSchema(ClockInvalidError, 'Invalid clock timestamps.')],
    description: 'Invalid request body or invalid clock timestamps.',
  },
  'Invalid request body or invalid clock timestamps.',
);
const unauthenticated = content(TokenAuthenticationErrorSchema, 'Missing or invalid access token.');
const limited = content(RateLimitErrorSchema, 'Rate limit exceeded.');
const unexpected = content(ErrorSchema(InternalError), 'Unexpected error.');
const notFound = content(ErrorSchema(ClockNotFoundError), 'The clock does not exist.');
const forbidden = (description: string): JsonSchema => content(UnauthorizedErrorSchema, description);

export const ClockResponses = {
  create: {
    200: content(ReplyEnvelopeSchema(ClockDataSchema, 'clock.created'), 'The created clock.'),
    400: invalid,
    401: unauthenticated,
    403: forbidden('The actor may not create a clock for this user.'),
    404: content(ErrorSchema(UserNotFoundError), 'The user does not exist.'),
    409: content(
      ErrorSchema(ClockOverlapError),
      'The clock overlaps another clock of the same user.',
    ),
    429: limited,
    500: unexpected,
  },
  current: {
    200: content(
      ReplyEnvelopeSchema(ClockCurrentDataSchema, 'clock.current.retrieved'),
      'The open clock of the caller, or null.',
    ),
    401: unauthenticated,
    403: forbidden('The actor lacks the clocks:read scope.'),
    429: limited,
    500: unexpected,
  },
  delete: {
    200: content(
      ReplyEnvelopeSchema(ClockDeleteDataResponseSchema, 'clock.deleted'),
      'Deleted identifiers and failures.',
    ),
    400: validation,
    401: unauthenticated,
    403: forbidden('The actor may not delete one of these clocks.'),
    429: limited,
    500: unexpected,
  },
  in: {
    200: content(ReplyEnvelopeSchema(ClockDataSchema, 'clock.started'), 'The opened clock.'),
    400: validation,
    401: unauthenticated,
    403: forbidden('The actor lacks the clocks:write scope.'),
    409: content(ErrorSchema(ClockConflictError), 'The user is already clocked in.'),
    429: limited,
    500: unexpected,
  },
  list: {
    200: content(ReplyEnvelopeSchema(ClockListDataSchema, 'clock.listed'), 'A page of clocks.'),
    400: validation,
    401: unauthenticated,
    403: forbidden('The actor lacks the clocks:read scope.'),
    429: limited,
    500: unexpected,
  },
  out: {
    200: content(ReplyEnvelopeSchema(ClockDataSchema, 'clock.stopped'), 'The closed clock.'),
    400: invalid,
    401: unauthenticated,
    403: forbidden('The actor lacks the clocks:write scope.'),
    409: content(ErrorSchema(ClockConflictError), 'The user is not clocked in.'),
    429: limited,
    500: unexpected,
  },
  retrieve: {
    200: content(ReplyEnvelopeSchema(ClockDataSchema, 'clock.retrieved'), 'The clock.'),
    400: validation,
    401: unauthenticated,
    403: forbidden('The actor may not read this clock.'),
    404: notFound,
    429: limited,
    500: unexpected,
  },
  update: {
    200: content(
      ReplyEnvelopeSchema(ClockUpdateDataResponseSchema, 'clock.updated'),
      'Updated identifiers and failures.',
    ),
    400: validation,
    401: unauthenticated,
    403: forbidden('The actor may not update one of these clocks.'),
    429: limited,
    500: unexpected,
  },
} as const;
