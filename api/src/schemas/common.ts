export type JsonSchema = Record<string, unknown>;

export class RequestLimits {
  public static readonly bulk = 100;
  public static readonly cursor = 200;
  public static readonly limit = 100;
  public static readonly limitDefault = 25;
}

export const NAME_PATTERN = "^[\\p{L}\\p{M}][\\p{L}\\p{M}' .-]*$";

export const PHONE_PATTERN = '^\\+?[0-9 ().-]{6,20}$';

export const IdListSchema = {
  description: 'List of user identifiers. Duplicates are ignored.',
  items: { format: 'uuid', type: 'string' },
  maxItems: RequestLimits.bulk,
  minItems: 1,
  type: 'array',
} as const;

export const DateBoundAnyOf = {
  anyOf: [
    { minimum: 0, type: 'integer' },
    { format: 'date-time', type: 'string' },
  ],
  description: 'Epoch milliseconds or an ISO 8601 date-time.',
  examples: [1767225600000, '2026-01-01T00:00:00.000Z'],
} as const;

export const ErrorResponseSchema = {
  additionalProperties: false,
  properties: {
    code: { description: 'Stable machine readable error code.', example: 'USER_NOT_FOUND', type: 'string' },
    message: {
      description: 'Human readable message, safe to display.',
      example: 'The user does not exist.',
      type: 'string',
    },
    request_id: {
      description: 'Identifier to quote when reporting a problem.',
      example: 'req-1',
      type: 'string',
    },
    status: { description: 'HTTP status code.', example: 404, type: 'integer' },
  },
  required: ['code', 'message', 'request_id', 'status'],
  type: 'object',
} as const;

/**
 * @route schemas.common.error
 * @param {string} description
 * @returns {JsonSchema}
 */
export const errorResponse = (description: string): JsonSchema => ({
  ...ErrorResponseSchema,
  description,
});

/**
 * @route schemas.common.envelope
 * @param {JsonSchema} dataSchema
 * @param {string} eventCode
 * @returns {JsonSchema}
 */
export const ReplyEnvelopeSchema = (dataSchema: JsonSchema, eventCode: string): JsonSchema => ({
  additionalProperties: false,
  description: 'Successful response.',
  properties: {
    data: dataSchema,
    event: { description: 'Event code describing what happened.', enum: [eventCode], type: 'string' },
  },
  required: ['data', 'event'],
  type: 'object',
});

export const BulkFailureSchema = {
  additionalProperties: false,
  properties: {
    code: { description: 'Error code explaining the failure.', example: 'USER_NOT_FOUND', type: 'string' },
    id: {
      description: 'Identifier that failed.',
      example: '0b3f4a9e-7d5c-4c1c-9a39-2f5f5a7a1e10',
      format: 'uuid',
      type: 'string',
    },
  },
  required: ['code', 'id'],
  type: 'object',
} as const;
