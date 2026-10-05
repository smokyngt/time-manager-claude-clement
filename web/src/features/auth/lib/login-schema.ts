import type { TFunction } from 'i18next'

import { z } from 'zod'

import { LIMITS } from '@/config/limits'

export function createLoginSchema(t: TFunction<'auth'>) {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, t('validation.email_required'))
      .max(LIMITS.email, t('validation.email_too_long', { max: LIMITS.email }))
      .pipe(z.email(t('validation.email_invalid'))),
    password: z
      .string()
      .min(1, t('validation.password_required'))
      .max(LIMITS.password.max, t('validation.password_too_long', { max: LIMITS.password.max })),
  })
}

export type LoginValues = z.infer<ReturnType<typeof createLoginSchema>>
