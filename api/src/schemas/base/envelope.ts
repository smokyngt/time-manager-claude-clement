import {
  RateLimitError,
  TokenAuthenticationError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/errors/base/core.js';

import type { ErrorFactory } from '@/lib/errors/base/registry.js';

export type JsonSchema = Record<string, unknown>;

export const ErrorResponseSchema = {
  additionalProperties: true,
  description: 'Problem details returned for every failed request.',
  properties: {
    code: {
      description: 'Stable machine readable error code.',
      example: 'team.not.found',
      type: 'string',
    },
    correlation_id: {
      description: 'Request identifier to quote when reporting a problem.',
      example: '0b3f4a9e-7d5c-4c1c-9a39-2f5f5a7a1e10',
      type: 'string',
    },
    errors: {
      description: 'Field level validation failures.',
      items: {
        additionalProperties: false,
        properties: {
          code: {
            description: 'Validation keyword that failed.',
            example: 'required',
            type: 'string',
          },
          params: {
            additionalProperties: true,
            description: 'Keyword parameters.',
            type: 'object',
          },
          path: {
            description: 'Location of the invalid value.',
            example: 'body.name',
            type: 'string',
          },
        },
        required: ['code', 'params', 'path'],
        type: 'object',
      },
      type: 'array',
    },
    instance: { description: 'Request path.', example: '/v1/teams/1', type: 'string' },
    metadata: {
      additionalProperties: true,
      description: 'Debug details, non production only.',
      type: 'object',
    },
    stack: { description: 'Stack trace, non production only.', type: 'string' },
    status: { description: 'HTTP status code.', example: 404, type: 'integer' },
    timestamp: { description: 'Epoch milliseconds.', example: 1_760_000_000_000, type: 'integer' },
  },
  required: ['code', 'correlation_id', 'instance', 'status', 'timestamp'],
  type: 'object',
} as const;

/**
 * @route schemas.envelope.error
 * @param {ErrorFactory} factory
 * @param {string} description
 * @returns {JsonSchema}
 */
export const ErrorSchema = (factory: ErrorFactory, description?: string): JsonSchema => ({
  allOf: [
    ErrorResponseSchema,
    {
      properties: {
        code: { const: factory.code },
        status: { const: factory.defaultStatus },
      },
      type: 'object',
    },
  ],
  description: description ?? factory.code,
});

export const ValidationErrorSchema = ErrorSchema(ValidationError, 'Invalid request.');

export const TokenAuthenticationErrorSchema = ErrorSchema(
  TokenAuthenticationError,
  'Missing, invalid or expired access token.',
);

export const UnauthorizedErrorSchema = ErrorSchema(
  UnauthorizedError,
  'The caller lacks the required scope or right.',
);

export const RateLimitErrorSchema = ErrorSchema(RateLimitError, 'Too many requests.');

/**
 * @route schemas.envelope.reply
 * @param {JsonSchema} dataSchema
 * @param {string} eventCode
 * @returns {JsonSchema}
 */
export const ReplyEnvelopeSchema = (dataSchema: JsonSchema, eventCode: string): JsonSchema => ({
  additionalProperties: false,
  description: 'Successful response.',
  properties: {
    data: {
      description: 'Named object holding the result of the operation.',
      ...dataSchema,
    },
    event: {
      additionalProperties: false,
      description: 'Event describing what happened, also written to the audit trail.',
      example: {
        code: eventCode,
        correlation_id: '0b3f4a9e-7d5c-4c1c-9a39-2f5f5a7a1e10',
        metadata: {},
        payload: { actor: '5d1f6a52-0b1e-4c0f-8d8e-2f9d1f6f3c11' },
      },
      properties: {
        code: { const: eventCode, description: 'Event code.', example: eventCode, type: 'string' },
        correlation_id: {
          description: 'Request identifier.',
          example: '0b3f4a9e-7d5c-4c1c-9a39-2f5f5a7a1e10',
          type: 'string',
        },
        metadata: { additionalProperties: true, description: 'Event metadata.', type: 'object' },
        payload: {
          additionalProperties: true,
          description: 'Event payload: actor, identifiers and counts.',
          type: 'object',
        },
      },
      required: ['code', 'correlation_id', 'metadata', 'payload'],
      type: 'object',
    },
    timestamp: {
      description: 'Epoch milliseconds.',
      example: 1_760_000_000_000,
      type: 'integer',
    },
  },
  required: ['data', 'event', 'timestamp'],
  type: 'object',
});
