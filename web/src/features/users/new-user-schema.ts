import { z } from 'zod'

export const newUserSchema = z.object({
  email: z.string().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
  first_name: z.string().trim().min(1, 'First name is required'),
  last_name: z.string().trim().min(1, 'Last name is required'),
  phone_number: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ().-]{6,20}$/, 'Enter a valid phone number'),
  role: z.enum(['employee', 'manager', 'admin']),
})

export type NewUserValues = z.infer<typeof newUserSchema>
