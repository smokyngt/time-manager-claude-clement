import { z } from 'zod'

import { PASSWORD_MIN_LENGTH } from '@/features/users/schemas'

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u
const PHONE_PATTERN = /^\+?[0-9 ().-]{6,20}$/

const nameField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(100, `${label} is too long`)
    .regex(NAME_PATTERN, `Enter a valid ${label.toLowerCase()}`)

export const profileSchema = z.object({
  first_name: nameField('First name'),
  last_name: nameField('Last name'),
  phone_number: z
    .string()
    .trim()
    .refine((value) => value === '' || PHONE_PATTERN.test(value), {
      message: 'Enter a valid phone number',
    }),
})

export const passwordSchema = z
  .object({
    confirm_password: z.string().min(1, 'Confirm your new password'),
    new_password: z
      .string()
      .min(1, 'New password is required')
      .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
      .max(128, 'Password must be at most 128 characters'),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export type PasswordValues = z.infer<typeof passwordSchema>
export type ProfileValues = z.infer<typeof profileSchema>
