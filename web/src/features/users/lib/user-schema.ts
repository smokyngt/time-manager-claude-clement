import type { Role } from '@time-manager/sdk'

import { z } from 'zod'

import type { UserField } from '@/features/users/lib/user-permissions'

import { LIMITS } from '@/config/limits'

export type UserFormValues = {
  email: string
  firstName: string
  lastName: string
  password: string
  phoneNumber: string
  role: Role
}

const ROLES = ['employee', 'manager', 'admin'] as const

function name(max: number) {
  return z
    .string()
    .trim()
    .min(1, 'form.errors.required')
    .max(max, 'form.errors.too_long')
    .regex(LIMITS.patterns.name, 'form.errors.invalid_name')
}

export class UserSchema {
  /**
   * @route client.features.users.userSchema.form
   * @param {readonly UserField[]} fields Fields shown by the form; the others are not validated.
   * @returns {z.ZodType<UserFormValues>}
   */
  static form(fields: readonly UserField[]) {
    const shown = (field: UserField) => fields.includes(field)
    return z.object({
      email: shown('email')
        ? z
            .string()
            .trim()
            .min(1, 'form.errors.required')
            .max(LIMITS.email, 'form.errors.too_long')
            .pipe(z.email('form.errors.invalid_email'))
        : z.string(),
      firstName: shown('firstName') ? name(LIMITS.firstName) : z.string(),
      lastName: shown('lastName') ? name(LIMITS.lastName) : z.string(),
      password: shown('password')
        ? z
            .string()
            .refine(
              (value) =>
                value === '' ||
                (value.length >= LIMITS.password.min && value.length <= LIMITS.password.max),
              'form.errors.password_length',
            )
        : z.string(),
      phoneNumber: shown('phoneNumber')
        ? z
            .string()
            .trim()
            .refine(
              (value) => value === '' || LIMITS.patterns.phone.test(value),
              'form.errors.invalid_phone',
            )
        : z.string(),
      role: z.enum(ROLES),
    })
  }
}
