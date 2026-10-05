import type { JsonSchema } from './base/envelope.js';

export class RequestLimits {
  public static readonly bulk = 100;
  public static readonly cursor = 200;
  public static readonly limit = 100;
  public static readonly limitDefault = 25;
}

export const NAME_PATTERN = "^[\\p{L}\\p{M}][\\p{L}\\p{M}' .-]*$";

export const PHONE_PATTERN = '^\\+?[0-9 ().-]{6,20}$';

export const DateBoundSchema = {
  anyOf: [
    { minimum: 0, type: 'integer' },
    { format: 'date-time', type: 'string' },
  ],
  description: 'Epoch milliseconds or an ISO 8601 date-time.',
  examples: [1767225600000, '2026-01-01T00:00:00.000Z'],
} as const;

/**
 * @route schemas.common.bulk
 * @param {string} code
 * @param {string} id
 * @returns {JsonSchema}
 */
export const BulkFailureSchema = (code: string, id: string): JsonSchema => ({
  additionalProperties: false,
  properties: {
    code: { description: 'Error code explaining the failure.', example: code, type: 'string' },
    id: { description: 'Identifier that failed.', example: id, format: 'uuid', type: 'string' },
  },
  required: ['code', 'id'],
  type: 'object',
});

/**
 * @route schemas.common.ids
 * @param {string} description
 * @param {string[]} example
 * @returns {JsonSchema}
 */
export const IdArraySchema = (description: string, example: string[]): JsonSchema => ({
  description,
  example,
  items: { example: example[0], format: 'uuid', type: 'string' },
  type: 'array',
});
