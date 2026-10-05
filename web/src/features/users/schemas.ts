import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 12

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u
const PHONE_PATTERN = /^\+?[0-9 ().-]{6,20}$/

const emailField = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .pipe(z.email('Enter a valid email address'))

const nameField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(100, `${label} is too long`)
    .regex(NAME_PATTERN, `Enter a valid ${label.toLowerCase()}`)

const optionalPassword = z
  .string()
  .refine((value) => value === '' || value.length >= PASSWORD_MIN_LENGTH, {
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  })

const optionalPhone = z
  .string()
  .trim()
  .refine((value) => value === '' || PHONE_PATTERN.test(value), {
    message: 'Enter a valid phone number',
  })

export const roleSchema = z.enum(['employee', 'manager', 'admin'])

export const newUserSchema = z.object({
  email: emailField,
  first_name: nameField('First name'),
  last_name: nameField('Last name'),
  password: optionalPassword,
  phone_number: optionalPhone,
  role: roleSchema,
})

export const editUserSchema = z.object({
  email: emailField.optional(),
  first_name: nameField('First name').optional(),
  last_name: nameField('Last name').optional(),
  password: optionalPassword.optional(),
  phone_number: optionalPhone.optional(),
  role: roleSchema.optional(),
})

export type EditUserValues = z.infer<typeof editUserSchema>
export type NewUserValues = z.infer<typeof newUserSchema>
