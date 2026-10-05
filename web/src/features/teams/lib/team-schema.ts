import { z } from 'zod'

import { LIMITS } from '@/config/limits'

export const teamSchema = z
  .object({
    description: z.string().trim().max(LIMITS.description, 'form.errors.description_max'),
    managerId: z.string(),
    name: z
      .string()
      .trim()
      .min(1, 'form.errors.name_required')
      .max(LIMITS.name, 'form.errors.name_max'),
    weeklyHoursTarget: z
      .number('form.errors.hours_invalid')
      .int('form.errors.hours_invalid')
      .min(LIMITS.weeklyHours.min, 'form.errors.hours_range')
      .max(LIMITS.weeklyHours.max, 'form.errors.hours_range'),
    workEnd: z.string().regex(LIMITS.patterns.time, 'form.errors.time_invalid'),
    workStart: z.string().regex(LIMITS.patterns.time, 'form.errors.time_invalid'),
  })
  .refine((values) => values.workEnd > values.workStart, {
    error: 'form.errors.end_after_start',
    path: ['workEnd'],
  })

export type TeamValues = z.output<typeof teamSchema>
