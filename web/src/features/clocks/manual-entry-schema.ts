import { z } from 'zod'

const MAX_DURATION_MS = 24 * 60 * 60 * 1000

export const manualEntrySchema = z
  .object({
    clocked_in_at: z.string().min(1, 'Start is required'),
    clocked_out_at: z.string().min(1, 'End is required'),
    note: z.string().trim().max(500, 'Note must be 500 characters or fewer'),
    user_id: z.string().min(1, 'Select a user'),
  })
  .superRefine((values, context) => {
    const start = new Date(values.clocked_in_at).getTime()
    const end = new Date(values.clocked_out_at).getTime()
    if (Number.isNaN(start) || Number.isNaN(end)) return
    if (start > Date.now()) {
      context.addIssue({
        code: 'custom',
        message: 'Start cannot be in the future',
        path: ['clocked_in_at'],
      })
    }
    if (end > Date.now()) {
      context.addIssue({
        code: 'custom',
        message: 'End cannot be in the future',
        path: ['clocked_out_at'],
      })
    }
    if (end <= start) {
      context.addIssue({
        code: 'custom',
        message: 'End must be after start',
        path: ['clocked_out_at'],
      })
    } else if (end - start > MAX_DURATION_MS) {
      context.addIssue({
        code: 'custom',
        message: 'An entry cannot exceed 24 hours',
        path: ['clocked_out_at'],
      })
    }
  })

export type ManualEntryValues = z.infer<typeof manualEntrySchema>
