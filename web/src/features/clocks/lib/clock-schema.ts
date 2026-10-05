import { z } from 'zod'

import { LIMITS } from '@/config/limits'
import { Dates } from '@/lib/dates'

export const MAX_CLOCK_MS = 24 * 60 * 60 * 1000

export const clockSchema = z
  .object({
    clockedInAt: z.string().min(1, 'form.errors.in_required'),
    clockedOutAt: z.string().min(1, 'form.errors.out_required'),
    note: z.string().trim().max(LIMITS.note, 'form.errors.note_too_long'),
    userId: z.string().min(1, 'form.errors.user_required'),
  })
  .superRefine((values, context) => {
    const start = Dates.fromInput(values.clockedInAt)
    const end = Dates.fromInput(values.clockedOutAt)
    if (start === null || end === null) {
      return
    }
    if (Dates.isFuture(start)) {
      context.addIssue({ code: 'custom', message: 'form.errors.in_future', path: ['clockedInAt'] })
    }
    if (Dates.isFuture(end)) {
      context.addIssue({
        code: 'custom',
        message: 'form.errors.out_future',
        path: ['clockedOutAt'],
      })
    }
    if (end <= start) {
      context.addIssue({
        code: 'custom',
        message: 'form.errors.out_before_in',
        path: ['clockedOutAt'],
      })
    } else if (end - start > MAX_CLOCK_MS) {
      context.addIssue({ code: 'custom', message: 'form.errors.too_long', path: ['clockedOutAt'] })
    }
  })

export type ClockFormValues = z.infer<typeof clockSchema>
