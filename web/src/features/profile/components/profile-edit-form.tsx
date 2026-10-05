import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { ProfileValues } from '@/features/profile/lib/schemas'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/features/profile/components/field'
import { ProfileSchemas } from '@/features/profile/lib/schemas'

export type ProfileEditFormProps = {
  defaults: ProfileValues
  onSubmit: (values: ProfileValues) => void
  pending: boolean
}

export function ProfileEditForm({ defaults, onSubmit, pending }: ProfileEditFormProps) {
  const { t } = useTranslation('profile')
  const schema = useMemo(() => ProfileSchemas.profile(t), [t])
  const {
    formState: { errors, isDirty },
    handleSubmit,
    register,
  } = useForm<ProfileValues>({ defaultValues: defaults, resolver: zodResolver(schema) })

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field error={errors.firstName?.message} id="profile-first-name" label={t('edit.first_name')}>
          <Input
            aria-invalid={Boolean(errors.firstName)}
            autoComplete="given-name"
            id="profile-first-name"
            {...register('firstName')}
          />
        </Field>
        <Field error={errors.lastName?.message} id="profile-last-name" label={t('edit.last_name')}>
          <Input
            aria-invalid={Boolean(errors.lastName)}
            autoComplete="family-name"
            id="profile-last-name"
            {...register('lastName')}
          />
        </Field>
        <Field
          className="sm:col-span-2"
          error={errors.phoneNumber?.message}
          id="profile-phone"
          label={t('edit.phone')}
        >
          <Input
            aria-invalid={Boolean(errors.phoneNumber)}
            autoComplete="tel"
            id="profile-phone"
            type="tel"
            {...register('phoneNumber')}
          />
        </Field>
      </div>
      <div className="flex sm:justify-end">
        <Button disabled={pending || !isDirty} type="submit">
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          {t('edit.save')}
        </Button>
      </div>
    </form>
  )
}
