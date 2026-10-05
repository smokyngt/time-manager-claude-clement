import { GRANULARITIES } from '@/types/entities/report.js';

import { errorResponse, ReplyEnvelopeSchema } from './common.js';

const USER_ID_EXAMPLE = '0b3f4a9e-7d5c-4c1c-9a39-2f5f5a7a1e10';
const TEAM_ID_EXAMPLE = '5d1c2b7a-3e4f-4a5b-8c9d-0e1f2a3b4c5d';

const fromProperty = {
  description: 'Start of the range in epoch milliseconds, inclusive.',
  example: 1767225600000,
  minimum: 0,
  type: 'integer',
} as const;

const toProperty = {
  description: 'End of the range in epoch milliseconds, exclusive. At most 366 days after from.',
  example: 1769904000000,
  minimum: 1,
  type: 'integer',
} as const;

const granularityProperty = {
  description: 'Size of each bucket of the series.',
  enum: GRANULARITIES,
  example: 'day',
  type: 'string',
} as const;

const integerMetric = (description: string, example: number) =>
  ({ description, example, type: 'integer' }) as const;

const rangeProperties = {
  from: { ...fromProperty, description: 'Start of the range in epoch milliseconds.' },
  granularity: granularityProperty,
  to: { ...toProperty, description: 'End of the range in epoch milliseconds.' },
} as const;

export const ReportUserBodySchema = {
  additionalProperties: false,
  properties: {
    from: fromProperty,
    granularity: granularityProperty,
    to: toProperty,
    user_id: {
      description: 'Identifier of the user to report on.',
      example: USER_ID_EXAMPLE,
      format: 'uuid',
      type: 'string',
    },
  },
  required: ['from', 'granularity', 'to', 'user_id'],
  type: 'object',
} as const;

export const ReportTeamBodySchema = {
  additionalProperties: false,
  properties: {
    from: fromProperty,
    granularity: granularityProperty,
    team_id: {
      description: 'Identifier of the team to report on.',
      example: TEAM_ID_EXAMPLE,
      format: 'uuid',
      type: 'string',
    },
    to: toProperty,
  },
  required: ['from', 'granularity', 'team_id', 'to'],
  type: 'object',
} as const;

export const UserReportSchema = {
  additionalProperties: false,
  description: 'Working time indicators of one user over a range.',
  properties: {
    ...rangeProperties,
    kpis: {
      additionalProperties: false,
      properties: {
        average_daily_ms: integerMetric(
          'Worked time divided by days worked, 0 when none.',
          25_200_000,
        ),
        days_worked: integerMetric('Distinct days with at least one clock.', 20),
        late_days: integerMetric('Days whose first clock-in is more than 5 minutes late.', 2),
        lateness_rate: {
          description: 'Late days divided by days worked, between 0 and 1.',
          example: 0.1,
          maximum: 1,
          minimum: 0,
          type: 'number',
        },
        overtime_ms: integerMetric(
          'Worked time minus target time, negative when under.',
          3_600_000,
        ),
        target_ms: integerMetric(
          'Weekly target prorated to the working days of the range.',
          126_000_000,
        ),
        worked_ms: integerMetric('Total worked time in the range.', 129_600_000),
      },
      required: [
        'average_daily_ms',
        'days_worked',
        'late_days',
        'lateness_rate',
        'overtime_ms',
        'target_ms',
        'worked_ms',
      ],
      type: 'object',
    },
    object: {
      description: 'Object type.',
      enum: ['user_report'],
      example: 'user_report',
      type: 'string',
    },
    series: {
      description: 'One zero-filled bucket per period of the range.',
      items: {
        additionalProperties: false,
        properties: {
          late: integerMetric('Late days in the period.', 1),
          period_start: integerMetric('Start of the period in epoch milliseconds.', 1767225600000),
          worked_ms: integerMetric('Worked time in the period.', 25_200_000),
        },
        required: ['late', 'period_start', 'worked_ms'],
        type: 'object',
      },
      type: 'array',
    },
    user_id: {
      description: 'Identifier of the reported user.',
      example: USER_ID_EXAMPLE,
      format: 'uuid',
      type: 'string',
    },
  },
  required: ['from', 'granularity', 'kpis', 'object', 'series', 'to', 'user_id'],
  type: 'object',
} as const;

export const TeamReportSchema = {
  additionalProperties: false,
  description: 'Working time indicators of one team over a range.',
  properties: {
    ...rangeProperties,
    kpis: {
      additionalProperties: false,
      properties: {
        active_members: integerMetric('Members with worked time in the range.', 4),
        average_daily_ms: integerMetric(
          'Worked time divided by member days worked, 0 when none.',
          25_200_000,
        ),
        late_days: integerMetric(
          'Member days whose first clock-in is more than 5 minutes late.',
          6,
        ),
        lateness_rate: {
          description: 'Late days divided by member days worked, between 0 and 1.',
          example: 0.07,
          maximum: 1,
          minimum: 0,
          type: 'number',
        },
        member_count: integerMetric('Active members of the team.', 5),
        overtime_ms: integerMetric('Sum of member overtime, negative when under.', -3_600_000),
        worked_ms: integerMetric('Total worked time of the team in the range.', 518_400_000),
      },
      required: [
        'active_members',
        'average_daily_ms',
        'late_days',
        'lateness_rate',
        'member_count',
        'overtime_ms',
        'worked_ms',
      ],
      type: 'object',
    },
    members: {
      description: 'Indicators of every member of the team.',
      items: {
        additionalProperties: false,
        properties: {
          days_worked: integerMetric('Distinct days with at least one clock.', 20),
          first_name: { description: 'First name.', example: 'Jane', type: 'string' },
          last_name: { description: 'Last name.', example: 'Doe', type: 'string' },
          late_days: integerMetric('Days whose first clock-in is more than 5 minutes late.', 2),
          overtime_ms: integerMetric(
            'Worked time minus target time, negative when under.',
            3_600_000,
          ),
          user_id: {
            description: 'Identifier of the member.',
            example: USER_ID_EXAMPLE,
            format: 'uuid',
            type: 'string',
          },
          worked_ms: integerMetric('Total worked time in the range.', 129_600_000),
        },
        required: [
          'days_worked',
          'first_name',
          'last_name',
          'late_days',
          'overtime_ms',
          'user_id',
          'worked_ms',
        ],
        type: 'object',
      },
      type: 'array',
    },
    object: {
      description: 'Object type.',
      enum: ['team_report'],
      example: 'team_report',
      type: 'string',
    },
    series: {
      description: 'One zero-filled bucket per period of the range.',
      items: {
        additionalProperties: false,
        properties: {
          period_start: integerMetric('Start of the period in epoch milliseconds.', 1767225600000),
          worked_ms: integerMetric('Worked time of the team in the period.', 126_000_000),
        },
        required: ['period_start', 'worked_ms'],
        type: 'object',
      },
      type: 'array',
    },
    team_id: {
      description: 'Identifier of the reported team.',
      example: TEAM_ID_EXAMPLE,
      format: 'uuid',
      type: 'string',
    },
  },
  required: ['from', 'granularity', 'kpis', 'members', 'object', 'series', 'team_id', 'to'],
  type: 'object',
} as const;

export const ReportResponses = {
  team: {
    200: ReplyEnvelopeSchema(TeamReportSchema, 'report.team.generated'),
    400: errorResponse('Invalid request body or report range.'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not read the report of this team.'),
    404: errorResponse('The team does not exist.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
  user: {
    200: ReplyEnvelopeSchema(UserReportSchema, 'report.user.generated'),
    400: errorResponse('Invalid request body or report range.'),
    401: errorResponse('Missing or invalid access token.'),
    403: errorResponse('The actor may not read the report of this user.'),
    404: errorResponse('The user does not exist.'),
    429: errorResponse('Rate limit exceeded.'),
    500: errorResponse('Unexpected error.'),
  },
} as const;
