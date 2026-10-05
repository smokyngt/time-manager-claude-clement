import type { TFunction } from 'i18next'

import { z } from 'zod'

import { LIMITS } from '@/config/limits'

export type ProfileValues = {
  firstName: string
  lastName: string
  phoneNumber: string
}

export type PasswordValues = {
  confirmPassword: string
  currentPassword: string
  newPassword: string
}

export class ProfileSchemas {
  /**
   * @route client.features.profile.lib.profileSchemas.password
   * @param {TFunction} t Profile namespace translator.
   * @returns {z.ZodType<PasswordValues, PasswordValues>}
   */
  static password(t: TFunction): z.ZodType<PasswordValues, PasswordValues> {
    return z
      .object({
        confirmPassword: z.string().min(1, t('validation.confirm_required')),
        currentPassword: z.string().min(1, t('validation.current_required')),
        newPassword: z
          .string()
          .min(LIMITS.password.min, t('validation.password_min', { value: LIMITS.password.min }))
          .max(LIMITS.password.max, t('validation.password_max', { value: LIMITS.password.max })),
      })
      .refine((values) => values.newPassword === values.confirmPassword, {
        message: t('validation.password_mismatch'),
        path: ['confirmPassword'],
      })
  }

  /**
   * @route client.features.profile.lib.profileSchemas.profile
   * @param {TFunction} t Profile namespace translator.
   * @returns {z.ZodType<ProfileValues, ProfileValues>}
   */
  static profile(t: TFunction): z.ZodType<ProfileValues, ProfileValues> {
    const name = (max: number) =>
      z
        .string()
        .trim()
        .min(1, t('validation.name_required'))
        .max(max, t('validation.name_max', { value: max }))
        .regex(LIMITS.patterns.name, t('validation.name_invalid'))
    return z.object({
      firstName: name(LIMITS.firstName),
      lastName: name(LIMITS.lastName),
      phoneNumber: z
        .string()
        .trim()
        .refine(
          (value) =>
            value === '' ||
            (value.length >= LIMITS.phone.min &&
              value.length <= LIMITS.phone.max &&
              LIMITS.patterns.phone.test(value)),
          { message: t('validation.phone_invalid') },
        ),
    })
  }
}
